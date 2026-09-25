# Code Review — Issue #4 (Trending / Top Articles feed tab)

Pre-implementation review for Issue #4 (`ISSUES.md`). No new code exists
yet; this is an analysis of the current codebase to scope the work
safely, produced by the `code-reviewer` subagent. Read-only — no files
were modified to produce this report.

## 1. Backend article listing — current mechanics

File: `backend/controllers/articles.js`

- `allArticles` (lines 22-71) is the general listing endpoint (`GET
  /api/articles`), handling `author`, `tag`, `favorited` filters
  (REQ-013) and `limit`/`offset` pagination (REQ-031, default `limit=3`,
  `offset=0`).
  - Filtering: `tag` and `author` are applied as `where` clauses nested
    inside the `include` array (lines 28-41) — i.e. filtering happens via
    `include: [{ model: Tag, as: "tagList", where: { name: tag } }, ...]`.
    This is an INNER JOIN-style filter: it works for single-value
    equality only, and is the exact code Issue #20 (multi-tag AND
    filtering) would need to restructure (see section 4).
  - `favorited` is handled as a completely separate code path (lines
    48-52): it does `User.findOne` then `user.getFavorites(searchOptions)`
    / `user.countFavorites()` instead of querying `Article` directly.
    Note `searchOptions.order` (`[["createdAt","DESC"]]`, line 44) is
    still passed through here, so ordering is applied uniformly across
    both the `favorited` and non-`favorited` branches.
  - Ordering is currently hardcoded as `order: [["createdAt", "DESC"]]`
    (line 44) — a literal Sequelize order clause on a real column that
    exists on every row already fetched by the main query.
  - **Critical finding for this ticket:** `favoritesCount` is *not* a
    column produced by this query at all. It is computed **after** the
    page of rows is fetched, in the per-row loop at lines 57-65, via
    `helper/helpers.js`'s `appendFavorites` (lines 12-18):
    `article.countUsers()` issues a separate `SELECT COUNT(*)` against the
    `Favorites` join table for each individual article, and the result is
    stashed onto `article.dataValues.favoritesCount` in-memory. It is
    never part of the `Article.findAndCountAll` query, never in the
    `ORDER BY`, and never usable directly in a `where`/`order` clause as
    it exists today.
  - There is no dedicated `Favorite` Sequelize model (checked
    `backend/models/*.js` — only `Article.js`, `Comment.js`, `Tag.js`,
    `User.js`, `index.js` exist). The favorites join table is declared
    inline in `backend/models/article.js`'s `associate()` as
    `this.belongsToMany(User, { through: "Favorites", foreignKey:
    "articleId", timestamps: false })` (article.js lines 29-33) — a bare
    string table name, no model object to `include` or aggregate through
    Sequelize's ORM-level association helpers. Any DB-level "order by
    favorite count" therefore has no ready-made association to hang an
    `order`/`include` off of; it would require either (a) promoting
    `Favorites` to a real model so it can be included with a `separate:
    true, ... group/count` pattern, or (b) a raw
    `Sequelize.literal("(SELECT COUNT(*) FROM \"Favorites\" WHERE
    \"Favorites\".\"articleId\" = \"Article\".\"id\")")` subquery
    injected into `attributes`/`order`.

- `articlesFeed` (lines 122-150) is a fully separate function/code path
  for the personalized "Your Feed" (REQ-018) — it does not call or share
  code with `allArticles` beyond the same `Article.findAndCountAll` shape
  and the same `order: [["createdAt","DESC"]]` literal and the same
  per-row `appendFavorites`/`appendTagList` loop. There is no shared
  "build search options" helper between `allArticles` and `articlesFeed`
  — the query-building logic (the `where`/`include`/`order` object
  literal) is duplicated independently in each function (lines 27-45 vs
  130-136).

## 2. Personalized feed vs. general listing — routing implications

`backend/routes/articles.js`: `GET /` → `allArticles`, `GET /feed` →
`articlesFeed` (separate routes, separate handlers, no shared middleware
branching on a query param). This means:

- A "Top Articles" mode most naturally extends `allArticles` (the
  endpoint Global Feed/tag/author/favorited already use) via a new query
  param (e.g. `sort=favorites` or `orderBy=favorites`), rather than
  `articlesFeed`, since "Top Articles" per the ticket must be
  visitor-accessible with no auth requirement — `articlesFeed`
  unconditionally throws `UnauthorizedError` if `!loggedUser` (line 125),
  so reusing that endpoint would require removing/branching that gate,
  which risks affecting REQ-018's auth-required behavior for the actual
  personalized feed if done carelessly.
- Because `allArticles` and `articlesFeed` don't share a query-builder
  function today, adding "sort=favorites" support only to `allArticles`
  is a comparatively contained change — but note the ordering literal
  (`order: [["createdAt","DESC"]]`) is duplicated in both places, so if a
  future dev assumes "there's one place ordering is decided," they'd be
  wrong; this duplication is a pre-existing latent risk independent of
  this ticket, worth being aware of rather than fixing here.

## 3. Frontend feed tabs

- `frontend/src/context/FeedContext.jsx`: `tabName` state is a bare
  string (`"feed"`, `"global"`, `"tag"`, defaulted based on `isAuth`,
  lines 12-19). `changeTab` (lines 21-25) is generic — it just calls
  `setTab({ tabName, tagName })` where `tabName` is passed in as an
  argument by the caller. This does **not** assume exactly two tabs;
  adding a third literal tab name (e.g. `"top"`) requires no change to
  `FeedContext.jsx` itself.
- `frontend/src/components/FeedToggler/FeedToggler.jsx` (lines 9-20):
  renders `<FeedNavLink name="feed" text="Your Feed">` only `{isAuth &&
  ...}`, and unconditionally renders `<FeedNavLink name="global"
  text="Global Feed">`. A third `<FeedNavLink name="top" text="Top
  Articles">` rendered unconditionally (matching the ticket's "selectable
  by any visitor, logged in or not") plugs in cleanly alongside the
  existing two — the component doesn't hardcode "exactly 2" anywhere;
  it's a flat list of conditionally-rendered `FeedNavLink`s.
- `frontend/src/services/getArticles.js` (lines 5-21): `url` is a plain
  object keyed by `location` (`favorites`, `feed`, `global`, `profile`,
  `tag`). Adding a `top:
  "api/articles?sort=favorites&limit=${limit}&&offset=${page}"` key
  follows the exact existing pattern — no restructuring needed, this
  generalizes fine to N tabs.
- `frontend/src/hooks/useArticles.js` (lines 13-22): the `useEffect`
  re-fetches whenever `tabName` (among other deps) changes, and
  `frontend/src/routes/HomeArticles.jsx` (lines 15-18) renders a loading
  placeholder in place of `ArticlesPreview`/`ArticlesPagination` while
  `loading` is true. Because `ArticlesPagination` (and `ReactPaginate`,
  which keeps its own uncontrolled internal page-index state, no
  `forcePage` prop set — see
  `frontend/src/components/ArticlesPagination/ArticlesPagination.jsx`) is
  unmounted during every tab switch's loading phase and only remounted
  once new data arrives, the "no stale data across tabs" requirement
  already falls out for free from the existing loading-gated conditional
  render — this is **not** something that needs new plumbing, it's an
  existing generic behavior the third tab inherits automatically as long
  as the new tab follows the same `useArticleList`/`loading` wiring as
  the other two.

## 4. Concrete overlap with Issue #20 (multi-tag AND filtering)

Both tickets need to touch the exact same lines:
`backend/controllers/articles.js`, `allArticles`, lines 26-45 —
specifically the `searchOptions` object literal, in particular:

- The `tag` handling inside the `include` array (lines 29-34: `{ model:
  Tag, as: "tagList", ..., ...(tag && { where: { name: tag } }) }`) is
  what #20 must generalize from single-value equality to a multi-value
  AND match (likely requiring a restructure away from a simple nested
  `where` — e.g. grouping/having, or multiple joins, or a subquery per
  tag).
- The `order: [["createdAt", "DESC"]]` line (line 44) is what #4 must
  generalize into a conditional order clause based on a new
  `sort`/mode param.
- Both changes land in the same object literal in the same function, and
  both are plausible to require moving away from "one flat
  `searchOptions` literal" toward something more compositional (e.g.
  building `where`/`include`/`order` conditionally in stages). If both
  tickets are implemented independently and merged out of order, whoever
  rebases second is very likely to hit a merge conflict directly in this
  object literal (not just a semantic conflict but a literal same-lines
  diff conflict), and will also need to verify the multi-tag join
  restructure (#20) doesn't accidentally break favorites-count ordering
  (#4) if #4's implementation uses a subquery in `attributes`/`order`
  that assumes a particular join shape from `include`. This matches and
  gives concrete substance to the ticket's own coordination note.

## 5. Existing tests that lock in assumptions a new sort mode must not break

`backend/controllers/articles.test.js`:

- `describe("allArticles")`, test `"default pagination -> 3 per page,
  newest first, true total count"` (lines 386-406) and the
  `fakeArticleList` helper (lines 61-75) hardcode newest-first ordering
  by sorting the seed rows by `createdAt DESC` before slicing by
  `offset`/`limit`, and hardcode that `articlesCount` reflects the
  pre-pagination total, not the page size. Any new `sort=favorites`
  implementation must preserve this exact default (no-sort-param)
  behavior — the mock harness (`fakeArticleList`) does not model an
  `order` argument at all (it always sorts by `createdAt` regardless of
  what's passed to `findAndCountAll`), so a new sort mode's DB-level
  `ORDER BY` logic cannot be verified through this existing mock without
  either extending `fakeArticleList` to respect an order/sort param or
  writing a new, separate fake for the top-articles case. This is a
  test-infrastructure gap the implementer will need to account for, not
  just an application-code gap.
- No existing test currently exercises "favorited-count-based ordering"
  or a tie-break rule, since the feature doesn't exist — the tie-break
  behavior (ticket calls out "newest first among equal counts" as a
  suggestion, not mandated) is entirely undefined by current tests and
  current code; the implementer is free to choose it but must add
  first-time coverage, and should verify whether a raw-SQL/`literal`
  approach's tie-break defaults (e.g. NULLs/ties ordering in the
  underlying DB engine) match whatever is documented.

## Summary of the most load-bearing findings

1. **CONFIRMED** — `favoritesCount` is computed post-fetch, per-row, via
   `article.countUsers()` in `helper/helpers.js` `appendFavorites` (lines
   12-18), not as part of the `Article.findAndCountAll` query in
   `allArticles` (`backend/controllers/articles.js` lines 42-45).
   Ordering by it therefore cannot be a simple `ORDER BY` addition on the
   existing query — it requires either promoting the bare `"Favorites"`
   join-table string (declared in `backend/models/article.js` lines
   29-33, with no dedicated model file) into something queryable at the
   DB level (a raw `Sequelize.literal` COUNT subquery, or a proper
   `Favorite` model + `include`/`group`), or fetching more broadly and
   sorting in memory before applying `limit`/`offset` (which would break
   correct pagination if done naively after the DB-level `LIMIT`/`OFFSET`
   is already applied).
2. **CONFIRMED** — Issue #4 and Issue #20 will very likely produce a
   literal merge conflict in the same `searchOptions` object literal in
   `allArticles` (`backend/controllers/articles.js` lines 27-45): #20
   touches the `tag` `include`/`where` clause (lines 29-34), #4 touches
   the `order` clause (line 44), both inside one contiguous object that
   currently has no internal seams for composing changes independently.
3. **CONFIRMED** — Frontend tab-switching (`FeedContext`, `FeedToggler`,
   `getArticles`, `useArticles`, `ArticlesPagination`) is already generic
   over tab count and does not assume exactly two tabs; the "no stale
   data across tabs" requirement is already satisfied structurally by
   the existing loading-gated unmount/remount of `ArticlesPagination`, so
   a third tab should not require new plumbing there.
4. **POSSIBLE CONCERN** — `articlesFeed` (personalized feed, REQ-018)
   unconditionally throws `UnauthorizedError` for anonymous visitors
   (`backend/controllers/articles.js` line 125); since Issue #4 requires
   "Top Articles" to be visitor-accessible without login, this reinforces
   that `allArticles` (not `articlesFeed`) is the correct endpoint to
   extend — reusing/branching `articlesFeed` for this would risk
   entangling with REQ-018's auth gate.
5. **CONFIRMED** — The existing backend test mock (`fakeArticleList` in
   `backend/controllers/articles.test.js` lines 61-75) hardcodes
   newest-first sorting inside the mock itself, ignoring whatever `order`
   value is actually passed to `findAndCountAll`. A new sort-by-favorites
   mode cannot be meaningfully unit-tested through this existing fake
   without extending it (or adding a separate fake) to respect the
   order/sort argument — this is a test-infrastructure gap to flag
   before writing new tests, not an application bug.

## Files read for this review

`backend/controllers/articles.js`, `backend/controllers/articles.test.js`,
`backend/routes/articles.js`, `backend/helper/helpers.js`,
`backend/models/article.js`, `backend/models/index.js` (listing only),
`frontend/src/context/FeedContext.jsx`,
`frontend/src/components/FeedToggler/FeedToggler.jsx`,
`frontend/src/components/FeedToggler/FeedNavLink.jsx`,
`frontend/src/hooks/useArticles.js`,
`frontend/src/services/getArticles.js`, `frontend/src/routes/Home.jsx`,
`frontend/src/routes/HomeArticles.jsx`,
`frontend/src/components/ArticlesPagination/ArticlesPagination.jsx`,
`ISSUES.md` (Issue #4 and Issue #20 sections), `REQUIREMENTS.md`
(REQ-013, REQ-018, REQ-030, REQ-031).
