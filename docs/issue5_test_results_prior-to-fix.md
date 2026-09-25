# Test Results — Issue #5 (Comment editing), prior to implementation

Baseline test run against the **current, unmodified `main` implementation**
(no comment-editing code exists yet — this file records that absence and
confirms nothing was silently broken while planning/documenting the
feature). Tested against the acceptance criteria drafted in
[`ACCEPTANCE_CRITERIA.md`](../ACCEPTANCE_CRITERIA.md) (`AC-080`–`AC-085`,
under `US-029`/`REQ-049`), per the task list in
[`docs/issue5_implementation_tasks.md`](./issue5_implementation_tasks.md).

**Method:** started the app locally (`npm run dev`; Postgres already
running via `docker compose`), then drove the real HTTP API end-to-end
with a small Node script (registered two users, created an article and a
comment, then exercised every edit scenario plus regression checks against
existing comment create/delete behavior). Also confirmed via source
reading and the existing automated suite. No production/shared system was
touched — all requests hit `localhost:3001` only.

## Summary

**Comment editing does not exist in the current implementation.** There
is no backend route, no controller function, no frontend service, and no
UI control for it. This matches expectations — Issue #5 has not been
implemented yet; this file is the "before" baseline, not a bug report.

## Static checks (source reading)

- `backend/controllers/comments.js` — exports only `allComments`,
  `createComment`, `deleteComment`. No `editComment`.
- `backend/routes/articles/comments.js` — registers `GET`, `POST`,
  `DELETE` on `/:slug/comments`(`/:commentId`). No `PUT` route.
- `frontend/src/components/CommentList/CommentList.jsx` — renders a
  delete button gated on `isAuth && loggedUser.username === username`; no
  edit control anywhere.
- No `frontend/src/services/editComment.js` exists.
- `backend/controllers/comments.test.js` — has `describe` blocks only for
  `allComments`, `createComment`, `deleteComment`; no `editComment` tests.
- `npx vitest run` (full suite, prior to any Issue #5 code): **12 test
  files, 84 tests, all passing** — confirms the baseline is green before
  any implementation work starts.

## Live API test results

Test article, comment, and two users (`A` = comment author, `B` =
non-author) created via the real API for this run.

| Acceptance criterion | Scenario | Expected (once implemented) | Actual (current) |
|---|---|---|---|
| `AC-084` | Unauthenticated `PUT` edit attempt | `401` authentication-required error | **`404`**, Express's generic HTML "Cannot PUT" page (no JSON error body) — the route simply doesn't exist |
| `AC-083` | Non-author (`B`) attempts to edit `A`'s comment | `403` authorization error | **`404`**, same generic Express page |
| `AC-080` | Author submits an empty body | `422` field-required error | **`404`**, same generic Express page |
| `AC-081` | Edit against a nonexistent comment ID | `404` not-found error *(app's own JSON error shape)* | **`404`**, but Express's generic HTML page, not the app's structured not-found response — coincidentally the same status code, for an unrelated reason |
| `AC-082` | Author submits a valid, non-empty edit | `200`, updated `{ comment }`, persisted | **`404`**, same generic Express page — no update occurs |
| `AC-085` | Author submits a whitespace-only body directly to the API | `200`, accepted (server checks truthiness only) | **`404`**, same generic Express page |

All six requests returned the exact same response:

```
HTTP/1.1 404 Not Found
Content-Type: text/html; charset=utf-8

<pre>Cannot PUT /api/articles/<slug>/comments/<id></pre>
```

This is Express's default no-route-matched handler, not the application's
own `NotFoundError` JSON error path (contrast with `AC-081`'s intended
behavior, and with `REQ-037`'s documented JSON error-mapping, neither of
which is reachable here since no route exists to trigger them).

**Persistence check:** after all six attempts above, `GET
/articles/:slug/comments` still returned the comment with its original,
unedited body (`"original comment text"`) — confirming no partial or
accidental mutation occurred despite the repeated failed requests.

## Regression checks (existing behavior, unaffected)

| Requirement | Check | Result |
|---|---|---|
| `REQ-022` | Comment creation (`POST`) still works | **Pass** — `201`, comment created |
| `REQ-023` | Non-author still cannot delete another user's comment | **Pass** — `403`, `"You are not the author of this comment"` |
| `REQ-023` | Comment's author can still delete their own comment | **Pass** — `200`, `"Comment deleted successfully"` |

No existing comment behavior was disturbed by the documentation-only
changes made so far (`REQ-049`/`US-029`/`AC-080`–`085`, `docs/TODO.md`,
`docs/issue5_implementation_tasks.md`).

## Conclusion / next step

This confirms the plan in `docs/TODO.md` and the task list in
`docs/issue5_implementation_tasks.md` are working from an accurate,
verified baseline: comment editing is entirely unimplemented, all six
drafted acceptance criteria currently fail (for the trivial reason that
the endpoint doesn't exist), and existing comment creation/deletion
behavior is unaffected. No code was changed to produce this report —
implementation has not started.
