# Plan — Issue #5: Comment editing

Source: `ISSUES.md`, "Issue 5 — Comment editing" (Size S/M, Full-stack).
Not yet started; this is a plan only, no code has been changed.

## 1. Ticket recap

Let a comment's author edit its text after posting.

- Only the author may edit (mirror delete's ownership rule, `REQ-023`).
- Unauthenticated visitors cannot edit.
- Edit requires a non-empty body, consistent with creation (`REQ-022`).
- Edited text persists (visible on reload, not just optimistic).
- Edit control only shown to the comment's author.
- Must not change comment creation (`REQ-022`) or deletion (`REQ-023`,
  `REQ-042`) behavior.

## 2. Before starting

- [ ] Claim the ticket: `gh issue edit 5 --add-assignee @me` (per
      `GITHUB.md` section 4); check `gh issue list --assignee ""` first to
      confirm it's unclaimed.
- [ ] Branch: `git checkout main && git pull origin main && git checkout -b
      <username>/feat-comment-editing`.
- [ ] Confirm `npm test` (or `npx vitest run` — see note below) passes
      clean on `main` before changing anything.

## 3. Current implementation (read before editing)

- Backend controller: `backend/controllers/comments.js` — has
  `allComments`, `createComment`, `deleteComment`. No `editComment` yet.
- Backend route: `backend/routes/articles/comments.js` — has `GET`,
  `POST`, `DELETE` on `/:slug/comments`; no `PUT`.
- Ownership-check pattern to mirror (already used twice — `deleteComment`
  in this file, and `updateArticle` in `backend/controllers/articles.js`
  around line 175): load the record, `if (loggedUser.id !== record.userId)
  throw new ForbiddenError(...)`.
- Frontend: `frontend/src/components/CommentList/CommentList.jsx` renders
  each comment and already gates the delete button on `isAuth &&
  loggedUser.username === username` — the same gate applies to a new edit
  control.
- Frontend services: `frontend/src/services/postComment.js` and
  `deleteComment.js` are the pattern for a new `editComment.js` (axios
  call + `errorHandler`).
- `CommentEditor.jsx` is the *new-comment* form (separate from list
  rendering) — not directly reused, but its textarea/submit pattern is
  the reference for the inline edit form.

## 4. Backend changes

**`backend/controllers/comments.js`**

Add `editComment`, modeled directly on `deleteComment` (ownership check)
and `createComment` (body validation):

```js
const editComment = async (req, res, next) => {
  try {
    const { loggedUser } = req;
    if (!loggedUser) throw new UnauthorizedError();

    const { body } = req.body.comment;
    if (!body) throw new FieldRequiredError("Comment body");

    const { commentId } = req.params;
    const comment = await Comment.findByPk(commentId);
    if (!comment) throw new NotFoundError("Comment");

    if (loggedUser.id !== comment.userId) {
      throw new ForbiddenError("comment");
    }

    comment.body = body;
    await comment.save();

    res.json({ comment });
  } catch (error) {
    next(error);
  }
};
```

Notes / open decisions:

- Validation: use the same truthiness-only check as `createComment`
  (`REQ-022`) — do **not** trim/reject whitespace-only bodies server-side,
  to stay consistent with existing creation behavior. Document this
  explicitly in the new `REQ-###` entry (see §6) since the ticket's
  acceptance criteria say "non-empty," and the existing precedent treats
  that as "truthy," not "non-whitespace."
- Response shape: return `{ comment }` like `createComment`, not the
  `{ message: { body: [...] } }` shape `deleteComment` uses — an edit
  returns the updated resource.
- Whether to include `author`/followers data in the response the way
  `createComment` does (`appendFollowers`) needs a decision: the frontend
  only needs updated `body`/`updatedAt`, and the comment's author/id don't
  change on edit, so this is likely unnecessary — confirm by checking what
  `CommentList.jsx` actually reads before adding it.
- Export `editComment` from `module.exports` at the bottom of the file.

**`backend/routes/articles/comments.js`**

Add:

```js
router.put("/:slug/comments/:commentId", verifyToken, editComment);
```

(alongside the existing `GET`/`POST`/`DELETE` on the same paths), and
import `editComment` from the controller.

## 5. Frontend changes

**New service — `frontend/src/services/editComment.js`**, mirroring
`deleteComment.js`/`postComment.js`:

```js
import axios from "axios";
import errorHandler from "../helpers/errorHandler";

async function editComment({ body, commentId, headers, slug }) {
  try {
    const { data } = await axios({
      data: { comment: { body } },
      headers,
      method: "PUT",
      url: `api/articles/${slug}/comments/${commentId}`,
    });

    return data.comment;
  } catch (error) {
    errorHandler(error);
  }
}

export default editComment;
```

**`frontend/src/components/CommentList/CommentList.jsx`**

- Add local state to track which comment (if any) is being edited (e.g.
  `editingId`) and a draft body for that comment.
- Where the delete button is currently gated on `isAuth &&
  loggedUser.username === username`, add an edit button under the same
  condition.
- When editing, replace the rendered `<p className="card-text">{body}</p>`
  for that comment with a small inline form (textarea + Save/Cancel),
  reusing the same non-empty-body guard as `CommentEditor.jsx`
  (`if (body.trim() === "") return;` client-side — this is a UX guard
  only; server-side stays truthiness-only per §4).
- On save, call the new `editComment` service, then call `updateComments`
  (the same prop `CommentList` already receives and uses after delete) to
  re-fetch/refresh the list from the server — this satisfies "persists on
  reload, not just optimistic," since the displayed data comes from a
  fresh `getComments` call rather than local state mutation.
- On cancel, just clear `editingId` without calling the service.

No changes are needed to `CommentEditor.jsx`, `CommentAuthor.jsx`,
`CommentsSection.jsx`, `getComments.js`, or `postComment.js`.

## 6. Documentation (Definition of Done item 3)

Use the `req-doc` skill after implementing (or once the shape of the
change is settled) to draft the actual entries — do not hand-write or
hardcode numbers here, since other tickets may land first. Substance to
capture, per `req-doc`'s conventions:

- **New `REQ-###`**: comment editing is restricted to the comment's
  author (cross-reference `REQ-023`); requires a non-empty (truthy) body,
  explicitly noting the same whitespace-only carve-out as `REQ-022`;
  unauthenticated edit attempts are rejected. State the endpoint
  (`PUT /api/articles/:slug/comments/:commentId`) and response shape.
- **New `US-###`**: the user story already given in the ticket ("As a
  comment author, I want to edit my own comment...").
- **New `AC-###`** entries, mirroring the existing `AC-045`/`AC-046`
  (delete ownership) pair, but for edit: (a) author can edit own comment,
  content updates and persists; (b) non-author attempt is rejected
  (`ForbiddenError`); (c) unauthenticated attempt is rejected
  (`UnauthorizedError`); (d) empty body is rejected
  (`FieldRequiredError`); (e) whitespace-only body is accepted
  server-side (characterization, matching `AC-043`'s existing precedent
  for creation).
- Add a new row to the Traceability Matrix in `ACCEPTANCE_CRITERIA.md`.
- Confirm no existing `REQ-001`–`REQ-046` entry's text changes — this is
  additive only.

## 7. Tests

Backend (`backend/controllers/comments.test.js`) — add a new
`describe("editComment", ...)` block, following the file's existing
style (`makeInstance`/`makeRes`/mocked `Comment.findByPk`, one behavior
per `test`, comments citing the `AC-###` each test targets once assigned):

- unauthenticated → `UnauthorizedError`, `Comment.save` not called
  (mirror the `deleteComment` "no loggedUser" test).
- empty body → `FieldRequiredError`, comment not modified (mirror
  `createComment`'s empty-body test).
- nonexistent comment id → `NotFoundError`.
- non-author attempts edit → `ForbiddenError`, body unchanged (mirror the
  existing `deleteComment` "non-author" test, adapted to assert the
  comment's `body` wasn't written rather than `destroy` wasn't called).
- comment author edits own comment → `comment.save()` called, response is
  `{ comment }` with the updated `body`.
- whitespace-only body → accepted (mirror `createComment`'s existing
  whitespace-only test) — this is a characterization test per
  `test/CLAUDE.md`, not a new requirement being asserted.

Frontend: there is currently **no existing precedent** in this repo for
component-level tests on `CommentList`/`CommentEditor`, or for testing
axios-based services like `postComment.js`/`deleteComment.js` directly —
existing frontend tests only cover pure helpers (`dateFormatter`,
`errorHandler`). Don't introduce a new testing pattern/abstraction for
this ticket alone (`frontend/src/CLAUDE.md`'s "no speculative
generalization" guidance). Rely on manual verification of the new edit
UI end-to-end (Definition of Done item 1) instead of adding
component/service tests, unless a lightweight test fits the existing
helper-test style without new setup machinery.

## 8. Verification before opening the PR

- [ ] `npx vitest run` (not plain `npm test` — that script resolves to
      watch-mode `vitest` with no `run`, which will hang; see the
      environment-verification notes from this session) — all existing
      tests plus the new `editComment` tests pass.
- [ ] Manually exercise: edit as the author (persists after reload), edit
      attempt by a different logged-in user (rejected, no button shown),
      edit attempt while logged out (no button shown), empty-body submit
      blocked client-side.
- [ ] Confirm existing comment creation/deletion (`REQ-022`, `REQ-023`,
      `REQ-042`) still behave unchanged — rerun their existing tests and,
      if convenient, exercise them manually too.
- [ ] Run `req-doc` skill to add the `REQUIREMENTS.md`/`USER_STORIES.md`/
      `ACCEPTANCE_CRITERIA.md` entries with real, next-available numbers.

## 9. PR

Per `GITHUB.md` §5/§6 and the "closes a backlog issue" guidance:

```
gh pr create --base main \
  --title "Add comment editing" \
  --body "Implements #5.

- Adds PUT /api/articles/:slug/comments/:commentId, author-only edit
- Adds inline edit UI to CommentList, gated the same as the delete control
- Adds REQ-###/US-###/AC-### entries (see req-doc output)

Closes #5"
```

Do not merge, delete branches, or force-push — report the PR URL back
and wait for review/approval per `GITHUB.md` §6.
