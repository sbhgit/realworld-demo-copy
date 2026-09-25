# Implementation Tasks — Issue #4: Trending / Top Articles feed tab

Derived from [`docs/TODO-issue4.md`](./TODO-issue4.md) (the approved plan)
and the now-drafted [`REQ-050`](../REQUIREMENTS.md) /
[`US-030`](../USER_STORIES.md) /
[`AC-086`–`AC-091`](../ACCEPTANCE_CRITERIA.md) entries. This is a task
checklist for implementation — no code has been written yet.

## 0. Setup

- [ ] Claim the ticket: `gh issue edit 4 --add-assignee @me` (check
      `gh issue list --assignee ""` first).
- [ ] Check whether Issue #20 (multi-tag AND filtering) is claimed or has
      an open PR — both touch the same `searchOptions` object literal in
      `allArticles` (`ISSUES.md`'s "Known overlap" note). Note it here if
      so, and plan to rebase carefully rather than picking both at once.
- [ ] Branch: `git checkout main && git pull origin main && git checkout -b
      <username>/feat-top-articles`.
- [ ] Confirm `npx vitest run` passes clean on `main` before changing
      anything (do **not** rely on plain `npm test` — it resolves to
      watch-mode `vitest` and hangs). Baseline already recorded once in
      `docs/issue4_test_results_prior-to-fix.md` (12 files, 90 tests); a
      quick re-run at branch start is still worth doing in case `main`
      moved since.

## 1. Backend — controller

**File:** `backend/controllers/articles.js`, `allArticles`

- [ ] Read the `sort` query param alongside the existing `author`/`tag`/
      `favorited`/`limit`/`offset` params.
- [ ] When `sort === "favorites"`:
  - [ ] Add a computed `favoritesCount` attribute to the query via a raw
        `Sequelize.literal` subquery:
        `Sequelize.literal('(SELECT COUNT(*) FROM "Favorites" WHERE
        "Favorites"."articleId" = "Article"."id")')` — satisfies
        `AC-086`.
  - [ ] Set `order: [[Sequelize.literal("favoritesCount"), "DESC"],
        ["createdAt", "DESC"]]` — the second key is the tie-break,
        satisfies `AC-087`.
  - [ ] Confirm `limit`/`offset` are still applied at the DB level (not a
        fetch-broadly-then-sort-in-memory approach) so pagination and
        `articlesCount` stay correct — satisfies `AC-088`. Verify against
        the existing "default pagination" test's assertion style
        (`backend/controllers/articles.test.js` lines ~386-406).
- [ ] For any other `sort` value, or the parameter's absence, leave the
      existing `order: [["createdAt", "DESC"]]` unchanged — satisfies
      `AC-089`.
- [ ] **Decide-and-confirm during implementation** (per the plan's open
      question, now resolved as REQ-050's Boundary paragraph): when
      `favorited=<username>` is also present, `sort` must have **no
      effect** — the `favorited` branch (`user.getFavorites(searchOptions)`,
      lines ~48-52) keeps its existing `order: [["createdAt", "DESC"]]`
      regardless of `sort`. Do **not** add favorites-count ordering to
      that branch. Satisfies `AC-091`.
- [ ] Do not add any `sort` handling to `articlesFeed` — out of scope,
      and it would risk `REQ-018`'s auth gate (`articlesFeed`
      unconditionally throws `UnauthorizedError` for anonymous callers).
      No auth check should gate the new `sort=favorites` mode on
      `allArticles` — satisfies `AC-090`.
- [ ] Keep the diff scoped to the `order`/`attributes` lines of the
      `searchOptions` object literal — do not touch the `tag`/`author`
      `where`/`include` logic (Issue #20's territory), per `docs/
      issue4_code_reveiwer-output.md` §4.

**File:** `backend/routes/articles.js`

- [ ] No change needed — `sort` is a query param on the existing `GET /`
      route, not a new route or route file change.

## 2. Backend — tests

**File:** `backend/controllers/articles.test.js`

- [ ] Extend `fakeArticleList` (or add a parallel fake) so it respects an
      `order`/sort argument instead of always sorting by `createdAt` —
      this is a prerequisite for meaningfully testing the new mode (test-
      infrastructure gap flagged in `docs/issue4_code_reveiwer-output.md`
      §5), not just new test cases.
- [ ] Add test: default listing (no `sort` param) still orders newest-
      first — regression, must still pass unchanged (`AC-089`).
- [ ] Add test: unrecognized `sort` value falls back to default order,
      does not throw (`AC-089`).
- [ ] Add test: `sort=favorites` orders articles by favorite count
      descending (`AC-086`).
- [ ] Add test: articles with equal favorite counts tie-break newest-
      first under `sort=favorites` (`AC-087`).
- [ ] Add test: `sort=favorites` still respects `limit`/`offset`
      pagination and reports the true `articlesCount` (not page size)
      (`AC-088`).
- [ ] Add test: `sort=favorites` requires no `Authorization` header
      (`AC-090`).
- [ ] Add test: `sort=favorites` combined with `favorited=<username>`
      leaves that branch's existing newest-first order unchanged
      (`AC-091`).

## 3. Frontend — service

**File:** `frontend/src/services/getArticles.js`

- [ ] Add a `top` key to the `url` lookup object, following the existing
      pattern for `favorites`/`feed`/`global`/`profile`/`tag`, e.g.
      `` top: `api/articles?sort=favorites&limit=${limit}&&offset=${page}` ``.

## 4. Frontend — UI

**File:** `frontend/src/components/FeedToggler/FeedToggler.jsx`

- [ ] Add a third `<FeedNavLink name="top" text="Top Articles">`,
      rendered unconditionally (no `isAuth` gate) alongside the existing
      `"feed"` (auth-gated) and `"global"` (unconditional) links —
      satisfies "selectable by any visitor, logged in or not."

**File:** `frontend/src/context/FeedContext.jsx`

- [ ] No change needed — `tabName`/`changeTab` are already generic over
      tab name strings; confirm this by reading the file, don't assume.

**Files:** `frontend/src/hooks/useArticles.js`,
`frontend/src/routes/HomeArticles.jsx`

- [ ] No change needed — the existing `tabName`-keyed `useEffect`
      re-fetch and the loading-gated unmount of `ArticlesPagination`
      already prevent stale data across tab switches. Confirm this holds
      for the new `"top"` tab by manual testing (§6), not by adding new
      plumbing.

- [ ] Do not modify default tab selection logic in
      `FeedContext.jsx`/`Home.jsx` (`REQ-030`) — "Top Articles" is an
      additional, explicitly selected tab, never a default.

## 5. Manual verification

- [ ] As an anonymous visitor, switch to "Top Articles" and confirm it's
      visible and selectable without logging in.
- [ ] Set up an older article with more favorites and a newer article
      with fewer/no favorites (mirrors the disambiguating setup already
      used in `docs/issue4_test_results_prior-to-fix.md`) and confirm
      "Top Articles" lists the higher-favorite article first despite
      being older.
- [ ] Confirm two articles with equal favorite counts appear newest-first
      relative to each other.
- [ ] Confirm pagination (3 per page, `REQ-031`) holds on the "Top
      Articles" tab.
- [ ] Switch between "Your Feed" / "Global Feed" / "Top Articles"
      repeatedly and confirm no stale data is shown from a previous tab
      during/after a switch.
- [ ] Confirm existing default tab selection (`REQ-030`: "Your Feed" if
      authenticated, "Global Feed" if not) is unchanged.
- [ ] Confirm the personalized feed (`REQ-018`) still requires auth and
      is unaffected.

## 6. Pre-PR checks

- [ ] `npx vitest run` — all existing tests plus the new sort-mode tests
      pass.
- [ ] `git status` / `git diff` reviewed — confirm no unrelated files
      staged, and confirm the backend diff is scoped to the `order`/
      `attributes` lines (not the `tag`/`author` filter logic Issue #20
      owns).
- [ ] Confirm `REQUIREMENTS.md`/`USER_STORIES.md`/`ACCEPTANCE_CRITERIA.md`
      already carry `REQ-050`/`US-030`/`AC-086`–`AC-091` (done — see
      `docs/TODO-issue4.md`) and that no existing `REQ-001`–`REQ-050`
      entry was changed.

## 7. Open the PR

Per `GITHUB.md` §5/§6:

```
gh pr create --base main \
  --title "Add Top Articles feed tab" \
  --body "Implements #4.

- Adds sort=favorites query param to GET /api/articles, ordered by
  favorite count descending, tie-broken newest-first
- Adds a visitor-accessible \"Top Articles\" tab alongside Your Feed /
  Global Feed
- Adds REQ-050/US-030/AC-086-091 documentation entries

Closes #4"
```

- [ ] Do not merge, delete branches, or force-push — report the PR URL
      back and wait for review/approval.
