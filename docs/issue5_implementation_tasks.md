# Implementation Tasks — Issue #5: Comment editing

Derived from [`docs/TODO.md`](./TODO.md) (the approved plan) and the
now-drafted [`REQ-049`](../REQUIREMENTS.md) / [`US-029`](../USER_STORIES.md) /
[`AC-080`–`AC-085`](../ACCEPTANCE_CRITERIA.md) entries. This is a task
checklist for implementation — no code has been written yet.

## 0. Setup

- [ ] Claim the ticket: `gh issue edit 5 --add-assignee @me` (check
      `gh issue list --assignee ""` first).
- [ ] Branch: `git checkout main && git pull origin main && git checkout -b
      <username>/feat-comment-editing`.
- [ ] Confirm `npx vitest run` passes clean on `main` before changing
      anything (do **not** rely on plain `npm test` — it resolves to
      watch-mode `vitest` and hangs).

## 1. Backend — controller

**File:** `backend/controllers/comments.js`

- [ ] Add `editComment`, modeled on the existing `deleteComment` (ownership
      check) and `createComment` (body validation):
  - [ ] `if (!loggedUser) throw new UnauthorizedError();` — satisfies
        `AC-084`.
  - [ ] `if (!body) throw new FieldRequiredError("Comment body");` — truthy
        check only, no trim — satisfies `AC-080` and `AC-085`.
  - [ ] `Comment.findByPk(commentId)`; `if (!comment) throw new
        NotFoundError("Comment");` — satisfies `AC-081`.
  - [ ] `if (loggedUser.id !== comment.userId) throw new
        ForbiddenError("comment");` — satisfies `AC-083`.
  - [ ] `comment.body = body; await comment.save();` then `res.json({
        comment })` — satisfies `AC-082`.
- [ ] **Decide and confirm**: does the response need
      `appendFollowers`/author data, or is `{ comment }` with the updated
      `body` sufficient? Check what `CommentList.jsx` actually reads
      before adding anything not needed.
- [ ] Export `editComment` in `module.exports`.

## 2. Backend — route

**File:** `backend/routes/articles/comments.js`

- [ ] Import `editComment` from the controller.
- [ ] Add `router.put("/:slug/comments/:commentId", verifyToken,
      editComment);` alongside the existing `GET`/`POST`/`DELETE`.

## 3. Backend — tests

**File:** `backend/controllers/comments.test.js`

Add `describe("editComment", ...)`, mirroring the file's existing style
(`makeInstance`/`makeRes`/mocked `Comment.findByPk`, one behavior per
`test`, cite the `AC-###` each test targets):

- [ ] No `loggedUser` → `UnauthorizedError`, `comment.save` not called
      (`AC-084`).
- [ ] Empty body → `FieldRequiredError`, comment not modified (`AC-080`).
- [ ] Nonexistent comment id → `NotFoundError` (`AC-081`).
- [ ] Non-author attempts edit → `ForbiddenError`, body unchanged
      (`AC-083`).
- [ ] Comment author edits own comment → `comment.save()` called,
      response is `{ comment }` with updated `body` (`AC-082`).
- [ ] Whitespace-only body → accepted (characterization test, not a new
      requirement — matches `createComment`'s existing whitespace test)
      (`AC-085`).

## 4. Frontend — service

**New file:** `frontend/src/services/editComment.js`

- [ ] Mirror `deleteComment.js`/`postComment.js`: axios call +
      `errorHandler`, `PUT` to `api/articles/${slug}/comments/${commentId}`
      with `{ comment: { body } }`, return `data.comment`.

## 5. Frontend — UI

**File:** `frontend/src/components/CommentList/CommentList.jsx`

- [ ] Add local state for which comment is being edited (e.g.
      `editingId`) and a draft body for that comment.
- [ ] Add an edit button gated on the same condition as the existing
      delete button: `isAuth && loggedUser.username === username`.
- [ ] When editing, replace the rendered `<p className="card-text">` for
      that comment with an inline form (textarea + Save/Cancel).
- [ ] Client-side guard before submit: `if (body.trim() === "") return;`
      (UX only — server stays truthiness-only per `REQ-049`).
- [ ] On Save: call `editComment`, then call `updateComments` (existing
      prop already used after delete) to refresh from the server — this
      is what satisfies "persists on reload, not just optimistic"
      (`AC-082`).
- [ ] On Cancel: clear `editingId`, no service call.
- [ ] No changes needed to `CommentEditor.jsx`, `CommentAuthor.jsx`,
      `CommentsSection.jsx`, `getComments.js`, or `postComment.js`.

## 6. Manual verification

- [ ] Edit as the comment's author → text updates and persists after a
      page reload.
- [ ] Edit attempt by a different logged-in user → rejected, no edit
      button shown for their view.
- [ ] Edit attempt while logged out → no edit button shown.
- [ ] Empty-body submit blocked client-side; whitespace-only blocked
      client-side but would be accepted if sent directly to the API.
- [ ] Existing comment creation and deletion still behave unchanged
      (`REQ-022`, `REQ-023`, `REQ-042`) — spot-check manually.

## 7. Pre-PR checks

- [ ] `npx vitest run` — all existing tests plus the new `editComment`
      tests pass.
- [ ] `git status` / `git diff` reviewed — confirm no unrelated files
      staged.
- [ ] Confirm `REQUIREMENTS.md`/`USER_STORIES.md`/`ACCEPTANCE_CRITERIA.md`
      already carry `REQ-049`/`US-029`/`AC-080`–`AC-085` (done — see
      `docs/TODO.md` §6 history) and that no existing `REQ-001`–`REQ-046`
      entry was changed.

## 8. Open the PR

Per `GITHUB.md` §5/§6:

```
gh pr create --base main \
  --title "Add comment editing" \
  --body "Implements #5.

- Adds PUT /api/articles/:slug/comments/:commentId, author-only edit
- Adds inline edit UI to CommentList, gated the same as the delete control
- Adds REQ-049/US-029/AC-080-085 documentation entries

Closes #5"
```

- [ ] Do not merge, delete branches, or force-push — report the PR URL
      back and wait for review/approval.
