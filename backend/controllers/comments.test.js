const {
  FieldRequiredError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
} = require("../helper/customErrors");
const { makeInstance, makeRes, mockRequire } = require("../test-utils/fakeModels");

const Article = { findOne: vi.fn() };
const Comment = { create: vi.fn(), findByPk: vi.fn() };
mockRequire(require.resolve("../models"), { Article, Comment, User: {} });

const { allComments, createComment, editComment, deleteComment } = require("./comments");

function makeFollowableUser(overrides = {}) {
  return makeInstance(
    { id: 1, username: "jane", ...overrides },
    { hasFollower: vi.fn().mockResolvedValue(false), countFollowers: vi.fn().mockResolvedValue(0) },
  );
}

function makeCommentWithAuthor(author) {
  return makeInstance(
    { id: 1, body: "hi" },
    { author, getAuthor: vi.fn().mockResolvedValue(author) },
  );
}

beforeEach(() => {
  Article.findOne.mockReset();
  Comment.create.mockReset();
  Comment.findByPk.mockReset();
});

describe("allComments", () => {
  // AC-004 / AC-044: comment listing does not require authentication.
  test("no loggedUser -> comments are still returned", async () => {
    const author = makeFollowableUser();
    const comment = makeCommentWithAuthor(author);
    const article = makeInstance({}, { getComments: vi.fn().mockResolvedValue([comment]) });
    Article.findOne.mockResolvedValue(article);
    const res = makeRes();

    await allComments({ loggedUser: undefined, params: { slug: "a-slug" } }, res, vi.fn());

    expect(res.json).toHaveBeenCalledWith({ comments: [comment] });
    expect(comment.author.dataValues.following).toBe(false);
  });

  test("nonexistent article slug -> NotFoundError", async () => {
    Article.findOne.mockResolvedValue(null);
    const next = vi.fn();

    await allComments({ params: { slug: "missing" } }, makeRes(), next);

    expect(next.mock.calls[0][0]).toBeInstanceOf(NotFoundError);
  });
});

describe("createComment", () => {
  test("no loggedUser -> UnauthorizedError", async () => {
    const next = vi.fn();

    await createComment({ loggedUser: undefined, body: { comment: {} } }, makeRes(), next);

    expect(next.mock.calls[0][0]).toBeInstanceOf(UnauthorizedError);
  });

  // AC-040: an empty body is rejected.
  test("empty body -> FieldRequiredError, no comment created", async () => {
    const next = vi.fn();

    await createComment(
      { loggedUser: makeFollowableUser(), body: { comment: { body: "" } }, params: { slug: "a" } },
      makeRes(),
      next,
    );

    expect(next.mock.calls[0][0]).toBeInstanceOf(FieldRequiredError);
    expect(Comment.create).not.toHaveBeenCalled();
  });

  // AC-041: a valid body against a nonexistent article slug is rejected.
  test("nonexistent article slug -> NotFoundError", async () => {
    Article.findOne.mockResolvedValue(null);
    const next = vi.fn();

    await createComment(
      { loggedUser: makeFollowableUser(), body: { comment: { body: "hi" } }, params: { slug: "missing" } },
      makeRes(),
      next,
    );

    expect(next.mock.calls[0][0]).toBeInstanceOf(NotFoundError);
  });

  // AC-043: the server only checks that `body` is truthy - a whitespace-only
  // body is accepted (the client is what blocks it, see AC-042).
  test("whitespace-only body -> accepted and created", async () => {
    Article.findOne.mockResolvedValue(makeInstance({ id: 5 }));
    Comment.create.mockResolvedValue(makeInstance({ id: 1, body: "   " }));
    const res = makeRes();

    await createComment(
      { loggedUser: makeFollowableUser(), body: { comment: { body: "   " } }, params: { slug: "a" } },
      res,
      vi.fn(),
    );

    expect(Comment.create).toHaveBeenCalledWith(expect.objectContaining({ body: "   " }));
    expect(res.status).toHaveBeenCalledWith(201);
  });
});

describe("editComment", () => {
  // AC-084: unauthenticated edit attempt is rejected.
  test("no loggedUser -> UnauthorizedError", async () => {
    const next = vi.fn();

    await editComment({ loggedUser: undefined, params: {}, body: { comment: {} } }, makeRes(), next);

    expect(next.mock.calls[0][0]).toBeInstanceOf(UnauthorizedError);
    expect(Comment.findByPk).not.toHaveBeenCalled();
  });

  // AC-080: an empty body is rejected.
  test("empty body -> FieldRequiredError, comment not modified", async () => {
    const next = vi.fn();

    await editComment(
      { loggedUser: makeFollowableUser(), body: { comment: { body: "" } }, params: { commentId: 1 } },
      makeRes(),
      next,
    );

    expect(next.mock.calls[0][0]).toBeInstanceOf(FieldRequiredError);
    expect(Comment.findByPk).not.toHaveBeenCalled();
  });

  // AC-081: editing a nonexistent comment id is rejected.
  test("nonexistent comment id -> NotFoundError", async () => {
    Comment.findByPk.mockResolvedValue(null);
    const next = vi.fn();

    await editComment(
      { loggedUser: makeFollowableUser(), body: { comment: { body: "edited" } }, params: { commentId: 999 } },
      makeRes(),
      next,
    );

    expect(next.mock.calls[0][0]).toBeInstanceOf(NotFoundError);
  });

  // AC-083: a non-author cannot edit someone else's comment.
  test("non-author attempts edit -> ForbiddenError, body unchanged", async () => {
    const comment = makeInstance({ id: 1, userId: 9, body: "original" }, { save: vi.fn().mockResolvedValue() });
    Comment.findByPk.mockResolvedValue(comment);
    const next = vi.fn();

    await editComment(
      {
        loggedUser: makeFollowableUser({ id: 2 }),
        body: { comment: { body: "hijacked" } },
        params: { commentId: 1 },
      },
      makeRes(),
      next,
    );

    expect(next.mock.calls[0][0]).toBeInstanceOf(ForbiddenError);
    expect(comment.body).toBe("original");
    expect(comment.save).not.toHaveBeenCalled();
  });

  // AC-082: the comment's author can edit it, and the update persists.
  test("comment author edits own comment", async () => {
    const comment = makeInstance({ id: 1, userId: 9, body: "original" }, { save: vi.fn().mockResolvedValue() });
    Comment.findByPk.mockResolvedValue(comment);
    const res = makeRes();

    await editComment(
      {
        loggedUser: makeFollowableUser({ id: 9 }),
        body: { comment: { body: "edited text" } },
        params: { commentId: 1 },
      },
      res,
      vi.fn(),
    );

    expect(comment.body).toBe("edited text");
    expect(comment.save).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ comment });
  });

  // AC-085: the server only checks that `body` is truthy - a whitespace-only
  // body is accepted, mirroring createComment's existing behavior (AC-043).
  test("whitespace-only body -> accepted and saved", async () => {
    const comment = makeInstance({ id: 1, userId: 9, body: "original" }, { save: vi.fn().mockResolvedValue() });
    Comment.findByPk.mockResolvedValue(comment);
    const res = makeRes();

    await editComment(
      {
        loggedUser: makeFollowableUser({ id: 9 }),
        body: { comment: { body: "   " } },
        params: { commentId: 1 },
      },
      res,
      vi.fn(),
    );

    expect(comment.body).toBe("   ");
    expect(comment.save).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ comment });
  });
});

describe("deleteComment", () => {
  test("no loggedUser -> UnauthorizedError", async () => {
    const next = vi.fn();

    await deleteComment({ loggedUser: undefined, params: {} }, makeRes(), next);

    expect(next.mock.calls[0][0]).toBeInstanceOf(UnauthorizedError);
  });

  // AC-045: the comment's author can delete it.
  test("comment author deletes own comment", async () => {
    const author = makeFollowableUser({ id: 9 });
    const comment = makeInstance({ id: 1, userId: 9 }, { destroy: vi.fn().mockResolvedValue() });
    Comment.findByPk.mockResolvedValue(comment);
    const res = makeRes();

    await deleteComment({ loggedUser: author, params: { commentId: 1 } }, res, vi.fn());

    expect(comment.destroy).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ message: { body: ["Comment deleted successfully"] } });
  });

  // AC-046: a non-author cannot delete someone else's comment.
  test("non-author attempts delete -> ForbiddenError, comment not destroyed", async () => {
    const comment = makeInstance({ id: 1, userId: 9 }, { destroy: vi.fn().mockResolvedValue() });
    Comment.findByPk.mockResolvedValue(comment);
    const next = vi.fn();

    await deleteComment(
      { loggedUser: makeFollowableUser({ id: 2 }), params: { commentId: 1 } },
      makeRes(),
      next,
    );

    expect(next.mock.calls[0][0]).toBeInstanceOf(ForbiddenError);
    expect(comment.destroy).not.toHaveBeenCalled();
  });
});
