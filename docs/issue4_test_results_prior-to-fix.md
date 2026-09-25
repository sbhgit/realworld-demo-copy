# Test Results — Issue #4 (Trending / Top Articles feed tab), prior to implementation

Baseline test run against the **current, unmodified `main` implementation**
(no Top Articles / sort-by-favorites code exists yet — this file records
that absence and confirms nothing was silently broken while scoping the
feature). Tested against `ISSUES.md`'s "Issue 4 — Trending / Top Articles
feed tab" acceptance criteria, informed by the pre-implementation review in
[`docs/issue4_code_reveiwer-output.md`](./issue4_code_reveiwer-output.md).
No `REQUIREMENTS.md`/`ACCEPTANCE_CRITERIA.md` entries exist yet for this
issue (unlike Issue #5), since scoping is still at the code-review stage.

**Method:** started the app locally (`npm run dev`; Postgres already
running via `docker compose`), then drove the real HTTP API end-to-end with
a small Node script (registered two users, created two articles — the
older one favorited by both users, a newer one left unfavorited — then
requested the article list under several plausible query-param guesses for
a "sort by favorites" mode). Also confirmed via source reading and the
existing automated suite. No production/shared system was touched — all
requests hit `localhost:3001` only.

## Summary

**The "Top Articles" / sort-by-favorites feed does not exist in the current
implementation.** There is no backend query-param handling for it, no
third frontend tab, and no dedicated favorites-count ordering at the
database level. This matches expectations — Issue #4 has not been
implemented yet; this file is the "before" baseline, not a bug report.

## Static checks (source reading)

- `backend/controllers/articles.js` — `allArticles` (`GET /api/articles`)
  hardcodes `order: [["createdAt", "DESC"]]` (line 44); no branch reads a
  `sort`/`orderBy`/similar query param. `favoritesCount` itself is computed
  **after** the page is fetched, per-row, via `appendFavorites` in
  `backend/helper/helpers.js` (lines 12-18) — it is never part of the
  `Article.findAndCountAll` query and is not usable in an `order` clause as
  written today.
- `backend/routes/articles.js` — only `GET /` (`allArticles`) and `GET
  /feed` (`articlesFeed`, auth-required, REQ-018) exist; no third route or
  query-param branch for a popularity-ordered listing.
- `frontend/src/components/FeedToggler/FeedToggler.jsx` — renders exactly
  two `FeedNavLink`s (`"feed"`, conditional on auth, and `"global"`,
  unconditional). No third ("Top Articles") link.
- `frontend/src/services/getArticles.js` — the `url` lookup object has keys
  for `favorites`, `feed`, `global`, `profile`, `tag` only; no `top` key
  and no `sort=favorites` query string anywhere in the file.
- `frontend/src/context/FeedContext.jsx` — `tabName` defaults to `"feed"`
  or `"global"` based on `isAuth`; no third default or literal `"top"`
  value referenced.
- `backend/controllers/articles.test.js` — `fakeArticleList` (lines 61-75)
  hardcodes newest-first sorting in the mock itself, independent of
  whatever `order` value is passed to `findAndCountAll`; no test exercises
  a favorites-count ordering mode, since the feature doesn't exist.
- `npx vitest run` (full suite, prior to any Issue #4 code): **12 test
  files, 90 tests, all passing** — confirms the baseline is green before
  any implementation work starts.

## Live API test results

Two users (`A`, `B`) and two articles created via the real API for this
run: an **older** article favorited by both `A` and `B` (`favoritesCount:
2`), and a **newer** article left unfavorited (`favoritesCount: 0`). This
ordering (older article = more favorites, newer article = fewer favorites)
was chosen deliberately so that "sorted by favorites" and "sorted by
newest" would disagree on which article comes first, making it possible to
tell whether any sort parameter has an effect.

| Request | Expected (once implemented) | Actual (current) |
|---|---|---|
| `GET /api/articles?sort=favorites&limit=20&offset=0` (no auth) | Older, higher-favorite article listed **first** | **`200`**, but order is unchanged: newer 0-favorite article still listed first, older 2-favorite article second — identical to the default (no-param) order |
| `GET /api/articles?orderBy=favorites&limit=20&offset=0` (no auth) | Same as above | **`200`**, same unchanged (newest-first) order as the default — this alternate param name is also silently ignored |
| `GET /api/articles?limit=20&offset=0` (no auth, no sort param — baseline) | Newest-first (existing REQ-013 behavior) | **`200`**, newest-first, as expected |

All three requests returned the exact same article ordering:

```
issue4-low-fav-newer-<id>: 0 favorites   (newer, unfavorited)
issue4-high-fav-older-<id>: 2 favorites  (older, favorited by A and B)
...(older pre-existing seed articles)
```

Both candidate query-param names (`sort=favorites`, `orderBy=favorites`)
are accepted by the endpoint without error (no `422`/`500` — they are
simply unrecognized keys that Express/Sequelize's query parsing silently
ignores) and have **zero effect** on result ordering. There is no way, in
the current implementation, for an anonymous or authenticated visitor to
request an article list ordered by favorite count.

**Anonymous favorited-flag/count check (regression, REQ-026):** the
favorited article's `favoritesCount: 2` was correctly reported to the
anonymous caller in every request above, while `favorited` was `false` for
all articles — confirming REQ-026 still holds and is independent of this
issue.

## Regression checks (existing behavior, unaffected)

| Requirement | Check | Result |
|---|---|---|
| `REQ-013` | Default article listing (no sort param) still orders newest-first | **Pass** |
| `REQ-025` | Favoriting an article (as `A`, then as `B`) still succeeds and increments `favoritesCount` correctly (`0 → 1 → 2`) | **Pass** |
| `REQ-026` | Anonymous caller still sees `favorited: false` for every article while `favoritesCount` reflects the true total | **Pass** |
| `REQ-030` | Nothing in this test run touched default tab selection logic | **Pass** (unexercised, unaffected — no code changed) |

No existing article-listing or favoriting behavior was disturbed. No code
was changed to produce this report — implementation has not started.

## Conclusion / next step

This confirms the scoping in `docs/issue4_code_reveiwer-output.md` is
working from an accurate, verified baseline: a "Top Articles" / sort-by-
favorites mode is entirely unimplemented on both backend and frontend,
neither of two plausible query-param names (`sort=favorites`,
`orderBy=favorites`) has any effect, and existing article listing/
favoriting behavior (`REQ-013`, `REQ-025`, `REQ-026`) is unaffected. Per
`ISSUES.md`'s stated constraint, implementation should also coordinate
with Issue #20 (multi-tag AND filtering), since both touch the same
`searchOptions` object literal in `allArticles`.
