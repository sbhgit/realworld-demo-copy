# Plan — Issue #4: Trending / Top Articles feed tab

Source: `ISSUES.md`, "Issue 4 — Trending / Top Articles feed tab" (Size M,
Full-stack). Not yet started; this is a plan only, no code has been
changed. Baseline confirmed in
[`docs/issue4_test_results_prior-to-fix.md`](./issue4_test_results_prior-to-fix.md)
(feature entirely absent, 90/90 existing tests passing) and informed by
the pre-implementation review in
[`docs/issue4_code_reveiwer-output.md`](./issue4_code_reveiwer-output.md).

## 1. Ticket recap

Add a third feed tab, "Top Articles", that lists articles ordered by
favorite count (highest first) instead of recency.

- Selectable by any visitor, logged in or not (unlike "Your Feed", which
  requires auth — `REQ-018`).
- Ordered by favorite count, highest first, with a defined tie-break
  (newest first among equal counts).
- Same pagination page size as other listings (`REQ-031`, 3/page).
- Tab switching must not show stale data across tabs (existing pattern).
- Must **not** change default tab selection logic (`REQ-030`) or any other
  existing `REQ-001`–`REQ-046` behavior.
- Coordinate with Issue #20 (multi-tag AND filtering) — both touch the
  same `searchOptions` object literal in `allArticles`; see §6.

## 2. Before starting

- [ ] Claim the ticket: `gh issue edit 4 --add-assignee @me` (per
      `GITHUB.md` §4); check `gh issue list --assignee ""` first to
      confirm it's unclaimed, and check whether Issue #20 is already
      claimed/in progress before starting (known overlap, `ISSUES.md`
      "Known overlap" section).
- [ ] Branch: `git checkout main && git pull origin main && git checkout -b
      <username>/feat-top-articles`.
- [ ] Confirm `npx vitest run` passes clean on `main` before changing
      anything (not plain `npm test` — that resolves to watch-mode
      `vitest` and hangs). Already confirmed once in
      `docs/issue4_test_results_prior-to-fix.md` (12 files, 90 tests); a
      quick re-run at branch start is still worth doing in case `main`
      moved.

## 3. Current implementation (read before editing)

- **Backend controller:** `backend/controllers/articles.js`,
  `allArticles` (lines ~22-71) — the general listing endpoint (`GET
  /api/articles`). Builds a `searchOptions` object with `where`/`include`
  (`author`, `tag`, `favorited` filters) and a hardcoded
  `order: [["createdAt", "DESC"]]` (line 44). No query param currently
  selects an alternate order.
- **Why favorites can't just be added to that `order` clause as-is:**
  `favoritesCount` is not a column on `Article` and is not produced by
  `Article.findAndCountAll` at all — it's computed **after** the page is
  fetched, per row, in `helper/helpers.js`'s `appendFavorites` (lines
  12-18) via `article.countUsers()` (a separate `SELECT COUNT(*)` per
  article against the `Favorites` join table). There is also no dedicated
  `Favorite` Sequelize model — the association is a bare string
  (`this.belongsToMany(User, { through: "Favorites", ... })` in
  `backend/models/article.js` lines 29-33), so there's no ready-made
  association to `include`/`group`/`order` through.
- **Personalized feed is a separate, unrelated code path:**
  `articlesFeed` (same file, lines ~122-150, `GET /api/articles/feed`)
  duplicates the same query shape independently and unconditionally throws
  `UnauthorizedError` for anonymous callers (line ~125). Since Top
  Articles must be visitor-accessible, it must extend `allArticles`, not
  `articlesFeed` — do not touch `articlesFeed`'s auth gate.
- **Route:** `backend/routes/articles.js` — `GET /` → `allArticles`, `GET
  /feed` → `articlesFeed`. No new route is needed; Top Articles is a new
  query-param mode on the existing `GET /` route.
- **Frontend tab plumbing already generalizes to N tabs** (no rework
  needed beyond adding the new option in each place):
  - `frontend/src/context/FeedContext.jsx` — `tabName` is a bare string,
    `changeTab` is generic.
  - `frontend/src/components/FeedToggler/FeedToggler.jsx` — flat list of
    conditionally-rendered `FeedNavLink`s; add one more, unconditional
    (visible to all visitors).
  - `frontend/src/services/getArticles.js` — `url` is a plain object keyed
    by `location`; add a `top` key.
  - `frontend/src/hooks/useArticles.js` / `HomeArticles.jsx` — re-fetch on
    `tabName` change, loading-gated unmount of `ArticlesPagination`
    already prevents stale cross-tab data for free.
- **Existing test mock gap:** `backend/controllers/articles.test.js`'s
  `fakeArticleList` helper (lines 61-75) hardcodes newest-first sorting
  *inside the mock itself*, ignoring whatever `order` is actually passed
  to `findAndCountAll`. New tests for favorites-ordering cannot be
  meaningfully verified through this fake as-is — it needs extending (or a
  separate fake) to respect a sort mode. See §5.

## 4. Backend changes

**File:** `backend/controllers/articles.js`, `allArticles`

Add a `sort` (or similarly named) query param, e.g. `sort=favorites`, that
switches the ordering. Because `favoritesCount` isn't a real column,
ordering by it at the DB level requires one of:

- **(a) Raw `Sequelize.literal` subquery** (smallest diff): add a computed
  `favoritesCount` attribute via
  `Sequelize.literal('(SELECT COUNT(*) FROM "Favorites" WHERE
  "Favorites"."articleId" = "Article"."id")')` to `attributes`, then
  `order: [[Sequelize.literal("favoritesCount"), "DESC"], ["createdAt",
  "DESC"]]` when `sort === "favorites"`, else the existing
  `order: [["createdAt", "DESC"]]`. Tie-break (`createdAt DESC`) satisfies
  the ticket's "newest first among equal counts" suggestion.
- **(b) Promote `Favorites` to a real model** and use
  `include`/`separate: true`/`group`+`order` through the ORM. More
  invasive (new model file, migration-free since the table already
  exists, but touches `models/article.js`'s association and
  `models/index.js`) — worth doing only if a literal subquery proves hard
  to combine with the existing `tag`/`author`/`favorited` `where`/
  `include` filters cleanly.

Recommendation: start with (a) — it's additive (new `attributes` entry +
conditional `order`), doesn't touch the existing `where`/`include` filter
logic Issue #20 will also be editing, and keeps the diff in the `order`
line specifically flagged as the overlap risk in
`docs/issue4_code_reveiwer-output.md` §4. Fall back to (b) only if testing
reveals the subquery doesn't compose with the `favorited` branch's
`user.getFavorites(searchOptions)` code path (lines ~48-52) — that branch
queries through `User`, not `Article`, so confirm during implementation
whether `sort=favorites` combined with `favorited=<username>` needs
special-casing, or whether it's acceptable for `sort` to be a no-op when
`favorited` is also set (decide and document either way — don't leave it
unspecified).

Notes / open decisions to resolve while implementing:

- Unrecognized/missing `sort` values must fall back to the existing
  default (`createdAt DESC`) — do not throw. (Confirmed via the baseline
  test in `docs/issue4_test_results_prior-to-fix.md`: unrecognized query
  params are currently silently ignored; preserve that permissiveness for
  any value other than the one recognized mode.)
- Do not add a `sort` branch inside `articlesFeed` — out of scope, and
  touching it risks `REQ-018`'s auth gate.
- `limit`/`offset` (`REQ-031`) apply unchanged — the new `order` is
  computed at the DB level before `LIMIT`/`OFFSET`, so pagination stays
  correct (avoid the "fetch broadly and sort in memory" anti-pattern
  called out in the code-review doc, which would break pagination).

**File:** `backend/routes/articles.js`

No change needed — `sort` is a query param on the existing `GET /` route,
not a new route.

## 5. Backend tests

**File:** `backend/controllers/articles.test.js`

- Extend `fakeArticleList` (or add a parallel fake) so it respects an
  `order`/sort argument instead of always sorting by `createdAt` — this
  is a prerequisite for meaningfully testing the new mode, not just new
  test cases (flagged in the code-review doc §5).
- Add a new `describe` block (or cases within `allArticles`'s existing
  one) covering:
  - Default listing (no `sort` param, or an unrecognized value) still
    orders newest-first — regression, must still pass unchanged.
  - `sort=favorites` orders by favorite count descending.
  - Equal favorite counts tie-break newest-first.
  - `sort=favorites` still respects `limit`/`offset` pagination and
    `articlesCount` (true total, not page size) — mirror the existing
    "default pagination" test's assertions (lines ~386-406).
  - Decide/cover the `sort=favorites` + `favorited=<username>` combination
    per whatever was decided in §4.

## 6. Coordination with Issue #20

Both tickets touch the same `searchOptions` object literal in
`allArticles` (`backend/controllers/articles.js`, lines ~27-45): #20
restructures the `tag` `include`/`where` clause for multi-tag AND
matching, this ticket changes the `order` clause (and adds an `attributes`
entry for approach (a)). To reduce conflict risk:

- [ ] Before starting, check `gh issue list` / open PRs for #20's status.
- [ ] Keep this ticket's diff to the `order`/`attributes` lines only —
      do not touch the `tag`/`author`/`favorited` `where`/`include` logic
      unless required by the interaction noted in §4.
- [ ] If #20 lands first, rebase onto its restructured `searchOptions`
      before continuing, and re-verify the `sort=favorites` +
      `favorited`/`tag` combinations still behave as decided.

## 7. Frontend changes

- **`frontend/src/components/FeedToggler/FeedToggler.jsx`** — add a third
  `<FeedNavLink name="top" text="Top Articles">`, rendered
  unconditionally (no `isAuth` gate), alongside the existing two.
- **`frontend/src/services/getArticles.js`** — add a `top` key to the
  `url` lookup object, following the existing pattern, e.g.
  `` top: `api/articles?sort=favorites&limit=${limit}&&offset=${page}` ``.
- **`frontend/src/context/FeedContext.jsx`** — no change required;
  `tabName`/`changeTab` are already generic over tab name strings.
- **`frontend/src/hooks/useArticles.js` /
  `frontend/src/routes/HomeArticles.jsx`** — no change required; the
  existing `tabName`-keyed `useEffect` re-fetch and loading-gated
  unmount of `ArticlesPagination` already give the new tab
  no-stale-data-across-tabs behavior for free.
- Do not modify default tab selection logic in `FeedContext.jsx`/
  `Home.jsx` (`REQ-030`) — "Top Articles" is an additional, explicitly
  selected tab, never a default.

## 8. Documentation (Definition of Done item 3)

Use the `req-doc` skill after implementing (or once the shape of the
change is settled) to draft the actual entries with real, next-available
numbers — do not hardcode numbers here. Substance to capture:

- **New `REQ-###`**: a `sort` query param on `GET /api/articles`
  (`allArticles`) that orders results by favorite count descending, tied
  by `createdAt` descending; default/unrecognized values preserve the
  existing newest-first order; state how (or whether) it composes with
  the `favorited` filter, per the decision in §4.
- **New `US-###`**: the user story already given in the ticket ("As a
  user, I want to browse articles sorted by how many favorites they've
  received...").
- **New `AC-###`** entries mirroring `AC-029`–`AC-033` (the existing
  listing-filter criteria): (a) `sort=favorites` returns articles ordered
  by favorite count descending; (b) equal counts tie-break newest-first;
  (c) pagination (`limit`/`offset`, `articlesCount`) behaves the same
  under this sort mode as the default; (d) no `sort` param or an
  unrecognized value preserves default newest-first ordering
  (regression characterization); (e) the tab is visitor-accessible
  without authentication.
- Add a new row to the Traceability Matrix in `ACCEPTANCE_CRITERIA.md`.
- Confirm no existing `REQ-001`–`REQ-046` entry's text changes — this is
  additive only.

## 9. Verification before opening the PR

- [ ] `npx vitest run` — all existing tests plus the new sort-mode tests
      pass.
- [ ] Manually exercise: switch to "Top Articles" as both an
      authenticated and an anonymous visitor; confirm ordering matches
      favorite counts (use the same "older article with more favorites
      vs. newer article with fewer" setup as
      `docs/issue4_test_results_prior-to-fix.md` to make the ordering
      unambiguous); confirm pagination (3/page, `REQ-031`) holds; confirm
      switching tabs shows no stale data.
- [ ] Confirm `REQ-013`/`REQ-018`/`REQ-030`/`REQ-031` behavior is
      unchanged — rerun their existing tests and spot-check manually
      (default tab selection, personalized feed's auth gate, default
      listing order).
- [ ] Run `req-doc` skill to add the `REQUIREMENTS.md`/`USER_STORIES.md`/
      `ACCEPTANCE_CRITERIA.md` entries with real, next-available numbers.

## 10. PR

Per `GITHUB.md` §5/§6 and the "closes a backlog issue" guidance:

```
gh pr create --base main \
  --title "Add Top Articles feed tab" \
  --body "Implements #4.

- Adds sort=favorites query param to GET /api/articles, ordered by
  favorite count descending, tie-broken newest-first
- Adds a visitor-accessible \"Top Articles\" tab alongside Your Feed /
  Global Feed
- Adds REQ-###/US-###/AC-### entries (see req-doc output)

Closes #4"
```

Do not merge, delete branches, or force-push — report the PR URL back and
wait for review/approval per `GITHUB.md` §6.
