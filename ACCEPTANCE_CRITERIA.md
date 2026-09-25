# Acceptance Criteria

Each criterion describes an observable, testable behavior of the current
implementation and traces to the user story (and, transitively, the
requirement) it supports. Criteria include boundary conditions and special
cases already present in the code; none describe how the code should be
changed.

---

### US-001 — Browse without logging in
*(REQ-001, REQ-013, REQ-019, REQ-021, REQ-024, REQ-026, REQ-028)*

- **AC-001** — Given no `Authorization` header, when the article list is
  requested, then the request succeeds and each returned article has
  `favorited: false`.
- **AC-002** — Given no `Authorization` header, when an existing article is
  requested by slug, then the article is returned.
- **AC-003** — Given no `Authorization` header, when a nonexistent article
  slug is requested, then a not-found error is returned.
- **AC-004** — Given no `Authorization` header, when the comment list for an
  existing article is requested, then the comments are returned.
- **AC-005** — Given no `Authorization` header, when the tag list is
  requested, then all tags are returned.
- **AC-006** — Given no `Authorization` header, when an article or profile
  is returned, then its `favorited`/`following` flag is `false` while its
  favorite/follower count still reflects the true total.

### US-002 — Register a new account
*(REQ-006, REQ-007, REQ-009, REQ-045)*

- **AC-007** — Given a registration request missing `username`, `email`, or
  `password`, when submitted, then a field-required error naming the first
  missing field (checked in order username, email, password) is returned.
- **AC-008** — Given a registration request whose email matches an existing
  account, when submitted, then a duplicate-email error is returned and no
  new account is created.
- **AC-009** — Given a registration request with a unique email and all
  required fields present, when submitted, then a new account is created
  and the response includes a session token.
- **AC-072** — Given the registration form, when a password of any
  non-empty length (including a single character) is entered, then the
  client does not block submission on password length — the form has no
  minimum-length constraint on its password field, unlike the login form
  (AC-073). The registration endpoint likewise enforces no minimum length,
  only rejecting a completely empty password.

### US-003 — Log in to an existing account
*(REQ-008, REQ-009, REQ-045)*

- **AC-010** — Given a login request whose email matches no account, when
  submitted, then a not-found error is returned.
- **AC-011** — Given a login request whose email matches an account but
  whose password does not match, when submitted, then a generic
  "wrong email/password combination" error is returned (the response does
  not indicate which of the two fields was wrong).
- **AC-012** — Given a login request with a matching email and correct
  password, when submitted, then the account data and a session token are
  returned.
- **AC-073** — Given the login form, when a password shorter than 5
  characters is entered, then the client blocks submission via the field's
  minimum-length constraint. This constraint exists only on the login form,
  not the registration form (AC-072); the login endpoint itself enforces no
  minimum length, only rejecting a completely empty password.

### US-004 — Session persists across reloads and time
*(REQ-029, REQ-004)*

- **AC-013** — Given a successful login or registration, when the browser
  page is reloaded, then the user remains signed in without re-entering
  credentials.
- **AC-014** — Given a session token issued at login, when it is presented
  after an extended period of time, then it is still accepted (no
  expiration is enforced).

### US-005 — Protected actions rejected without credentials
*(REQ-003, REQ-010)*

- **AC-015** — Given no `Authorization` header, when any of the following
  is requested — view/update own account, create/update/delete an article,
  create/delete a comment, favorite/unfavorite an article, follow/unfollow
  a user — then the request is rejected with an authentication-required
  (401) error.

### US-006 — View and update own profile
*(REQ-010, REQ-011, REQ-012)*

- **AC-016** — Given an authenticated user, when they request their own
  account, then the returned email is the one embedded in their session
  token, not necessarily re-read from the stored account row.
- **AC-017** — Given an authenticated user submitting an update with
  specific `username`/`email`/`bio`/`image` values, when saved, then each
  provided field is applied to the account, and any field submitted as
  `undefined` is left unchanged.
- **AC-018** — Given an authenticated user submitting a profile update where
  the `password` field is an empty string (i.e., the user did not intend to
  change their password), when saved, then the stored password hash is
  still overwritten with the hash of the empty string — there is no
  submitted `password` value that results in the existing password being
  left unchanged.

### US-007 — Publish a new article
*(REQ-015, REQ-020)*

- **AC-019** — Given an authenticated user submitting an article missing
  `title`, `description`, or `body`, when submitted, then a field-required
  error is returned and no article is created.
- **AC-020** — Given an authenticated user submitting a `title` whose
  derived slug matches an existing article's slug, when submitted, then a
  duplicate-title error is returned and no article is created.
- **AC-021** — Given an authenticated user submitting a valid article with a
  tag list, when created: each tag name already present in the system is
  attached to the article regardless of its length; each tag name not
  already present is created (using its trimmed form) and attached only if
  the **original, untrimmed** tag string is longer than 2 characters. A
  submitted tag such as `"  ab"` (4 characters before trimming, 2 after) is
  therefore created and attached, because the length check is performed
  before trimming — a not-already-present tag whose untrimmed string is 2
  characters or fewer is discarded without an error being reported.

### US-008 — Edit own article
*(REQ-016, REQ-017)*

- **AC-022** — Given the article's author submits an update including a new
  `title`, when saved, then the article's slug is regenerated from the new
  title and saved, with no check performed against other articles' slugs
  for a collision.
- **AC-023** — Given the article's author submits an update with an empty
  (falsy) `description` or `body`, when saved, then the existing
  `description`/`body` value is left unchanged rather than cleared.
- **AC-024** — Given a user who is not the article's author, when they
  attempt to update it, then the request is rejected with an authorization
  (403) error.

### US-009 — Delete own article
*(REQ-016)*

- **AC-025** — Given the article's author, when they delete the article,
  then it is removed and subsequently returns a not-found error when
  requested by slug.
- **AC-026** — Given a user who is not the article's author, when they
  attempt to delete it, then the request is rejected with an authorization
  (403) error.

### US-010 — View a single article by slug
*(REQ-019, REQ-043)*

- **AC-027** — Given an existing article's slug, when requested, then the
  full article (title, description, body, tags, author, dates) is returned.
- **AC-028** — Given a slug with no matching article, when requested, then a
  not-found (404) error is returned.
- **AC-070** — Given the article page is opened by following an in-app link
  that supplies the article's data via navigation state (e.g., from an
  article list), when the page renders, then it displays the supplied data
  directly without requesting the article from the server again for that
  page view. Given the article page is instead opened without such
  navigation state (a direct URL visit or a page reload), when the page
  renders, then it always requests the article from the server.

### US-011 — Browse and filter the article list
*(REQ-013, REQ-014, REQ-031)*

- **AC-029** — Given an `author` filter value, when the article list is
  requested, then only articles authored by that username are returned.
- **AC-030** — Given a `tag` filter value, when the article list is
  requested, then only articles carrying that tag are returned.
- **AC-031** — Given a `favorited` filter value naming an existing user,
  when the article list is requested, then only articles favorited by that
  user are returned.
- **AC-032** — Given a `favorited` filter value naming a username with no
  matching account, when the article list is requested, then the request
  fails with a server error (500) rather than returning an empty list.
- **AC-033** — Given no explicit page size is provided, when the article
  list is requested, then results are limited to 3 items per page and
  ordered newest-first; the client's pagination control likewise assumes 3
  items per page when computing the number of pages to display.

### US-012 — Personalized feed of followed authors
*(REQ-018, REQ-030)*

- **AC-034** — Given an authenticated user who follows one or more authors,
  when the personalized feed is requested, then only articles by followed
  authors are returned, newest first.
- **AC-035** — Given an authenticated user who follows no one, when the
  personalized feed is requested, then it returns zero articles (not an
  error).
- **AC-036** — Given the home page loads, when the visitor is authenticated,
  then the "Your Feed" tab is selected by default; when the visitor is not
  authenticated, then the "Global Feed" tab is selected by default.
- **AC-037** — Given the "Your Feed" tab is selected while there is no
  authenticated session, when the article list would be loaded, then no
  request is made and the view remains in a loading state indefinitely
  (it does not fall back to an empty-state or error message).

### US-013 — Browse popular tags
*(REQ-021, REQ-032)*

- **AC-038** — Given more than 50 tags exist in the system, when the
  popular-tags sidebar is rendered, then only the first 50 returned tags
  are displayed.
- **AC-039** — Given no authenticated session, when the tag list is
  requested, then it is still returned in full to the caller (the 50-tag
  cap is a client display limit, not a server-side limit).

### US-014 — Comment on an article
*(REQ-022, REQ-034)*

- **AC-040** — Given an authenticated user submitting a comment with an
  empty `body` directly to the API, when submitted, then a field-required
  error is returned.
- **AC-041** — Given an authenticated user submitting a comment for a
  nonexistent article slug, when submitted, then a not-found error is
  returned.
- **AC-042** — Given a comment body consisting only of whitespace entered in
  the comment form, when the user attempts to submit it, then the client
  does not send a request to the server.
- **AC-043** — Given a whitespace-only comment body sent directly to the API
  (bypassing the client's own check), when submitted, then the server
  accepts and creates the comment, because the server only checks that
  `body` is truthy, not that it contains non-whitespace content.

### US-015 — Read comments without logging in
*(REQ-024)*

- **AC-044** — Given no `Authorization` header, when the comment list for an
  existing article is requested, then the comments are returned.

### US-016 — Delete own comment
*(REQ-023, REQ-042)*

- **AC-045** — Given the comment's author, when they delete the comment,
  then it is removed from the article's comment list.
- **AC-046** — Given a user who is not the comment's author, when they
  attempt to delete it, then the request is rejected with an authorization
  (403) error.
- **AC-069** — Given an unauthenticated visitor clicks a comment's delete
  control, when the login-required alert is dismissed, then the
  delete-confirmation dialog is still shown next and, if confirmed, a
  delete request is still sent to the server (which then rejects it per
  AC-015). This differs from the article-delete control, which stops
  immediately after its login-required alert and never shows a
  confirmation dialog or sends a request in the same scenario.

### US-017 — Favorite or unfavorite an article
*(REQ-025, REQ-026)*

- **AC-047** — Given an authenticated user, when they favorite an article
  they have not yet favorited, then the article's `favorited` flag becomes
  `true` for that user and `favoritesCount` increases by one.
- **AC-048** — Given an authenticated user, when they unfavorite an article
  they previously favorited, then `favorited` becomes `false` for that user
  and `favoritesCount` decreases by one.
- **AC-049** — Given an authenticated user, when they attempt to
  favorite/unfavorite a nonexistent article slug, then a not-found error is
  returned.
- **AC-050** — Given no `Authorization` header, when an article is
  returned, then its `favorited` flag is `false` while `favoritesCount`
  still reflects the true total across all users.

### US-018 — Follow or unfollow a user
*(REQ-027, REQ-028, REQ-018)*

- **AC-051** — Given an authenticated user, when they follow an account
  they don't already follow, then that account's `following` flag becomes
  `true` for the follower, its `followersCount` increases by one, and its
  articles subsequently appear in the follower's personalized feed.
- **AC-052** — Given an authenticated user, when they unfollow an account
  they currently follow, then `following` becomes `false`,
  `followersCount` decreases by one, and its articles no longer appear in
  the follower's personalized feed.
- **AC-053** — Given an authenticated user, when they attempt to
  follow/unfollow a username with no matching account, then a not-found
  error is returned.

### US-019 — Accurate counts regardless of login state
*(REQ-026, REQ-028)*

- **AC-054** — Given any article or profile representation returned to an
  anonymous (unauthenticated) caller, when inspected, then its
  favorite/follower counts equal the true totals even though its
  `favorited`/`following` flags are forced to `false`.

### US-020 — Prevented from editing others' articles
*(REQ-035, REQ-016, REQ-044)*

- **AC-055** — Given a user who is not an article's author, when they open
  the article editor for that article's slug without any navigation state
  (e.g., by direct URL), then they are redirected away before the edit
  form is rendered.
- **AC-056** — Given a user who is not an article's author submits an
  update directly to the API (bypassing the client redirect), when
  submitted, then the server rejects it with an authorization (403) error.
- **AC-071** — Given the article editor is opened with navigation state
  already supplying the article's fields (as happens when reached via the
  edit link the application shows only to an article's own author), when
  the form renders, then the client does not re-fetch the article or
  re-check authorship before displaying it — the ownership check in AC-055
  only runs on the no-state path. A submission made through this path by
  someone other than the article's author is still rejected server-side,
  per AC-056.

### US-021 — Redirected from settings when unauthenticated
*(REQ-036, REQ-010)*

- **AC-057** — Given no authenticated session, when the account settings
  page is navigated to, then the visitor is redirected away from it.
- **AC-058** — Given no `Authorization` header, when the account-update
  endpoint is called directly, then the server rejects it with an
  authentication-required (401) error.

### US-022 — Default avatar for users without a profile image
*(REQ-033)*

- **AC-059** — Given a user whose `image` value is empty/not set, when
  their avatar is rendered anywhere in the client (navbar, article meta,
  comments, profile), then a bundled placeholder image is shown in its
  place.

### US-023 — Readable article/comment dates
*(REQ-040)*

- **AC-060** — Given the ISO date string `2020-01-01T12:11:08.212Z`, when
  formatted for display, then it renders as `January 1, 2020`. *(Verified
  by `frontend/src/helpers/dateFormatter.test.js`.)*

### US-024 — Consistent slug generation
*(REQ-039, REQ-015)*

- **AC-061** — Given the input strings `"  Hello World  "`,
  `"  Hello WORLD  "`, `" HELLO WORLD"`, `"Hello World"`, `"Hello_world "`,
  and `"Hello-world"`, when each is slugified, then all six produce the
  identical result `hello-world`. *(Verified by
  `backend/helper/helpers.test.js`.)*
- **AC-062** — Given a new article whose title slugifies to a value already
  used by an existing article, when creation is submitted, then it is
  rejected as a duplicate title.

### US-025 — Client surfaces error messages for common failures
*(REQ-037, REQ-038)*

- **AC-063** — Given an API response with status 401, 403, 404, 422, or
  500, when received by the client's error handler, then the handler
  throws the server-provided error message string. *(Verified by
  `frontend/src/helpers/errorHandler.test.js`, parameterized over these
  five statuses.)*
- **AC-064** — Given an API response with any status other than 401, 403,
  404, 422, or 500, or a failed request with no HTTP response at all (e.g.,
  a network failure), when received by the client's error handler, then the
  error is logged to the console but not thrown to the calling code.

### US-026 — Predictable rejection of invalid or stale credentials
*(REQ-002, REQ-003, REQ-005, REQ-041)*

- **AC-065** — Given an `Authorization` header whose value, when split on a
  space, does not yield a non-empty second element (no space present at
  all, or a trailing space with nothing after it), when any request is
  made, then the server responds with a generic server error (500) rather
  than a specific authentication error.
- **AC-066** — Given a session token whose signature verifies successfully
  but whose embedded email matches no existing account, when any
  authenticated request is made with it, then the server attempts to
  report a not-found condition and then, without stopping, triggers a
  second, unrelated error from the same request — the exact HTTP response
  the caller ultimately receives cannot be confirmed by reading the source
  alone and would require observing a running server.
- **AC-067** — Given no `Authorization` header is present at all, when a
  protected action is requested, then the server responds with a specific
  authentication-required error (401), distinguishable from the errors
  described in AC-065 and AC-066.
- **AC-068** — Given a session token whose signature cannot be verified
  (e.g., altered or signed with a different key), when any request is made
  with it, then the server responds with a single generic server error
  (500) — unlike AC-066, only one error-handling attempt occurs.

### US-027 — Frontend dev server reachable on the local network
*(REQ-046)*

- **AC-074** — Given the frontend development server's configuration, when
  inspected, then it is set to bind to `0.0.0.0` on port `2224`, rather
  than its previous `localhost`-only default on port `3000`.
- **AC-075** — Given the frontend development server is started via
  `npm run dev` with this configuration, when accessed from another device
  on the same local network at the host machine's IP address on port
  `2224`, then the application loads successfully.

### US-028 — Read-only MCP access to the local database
*(REQ-047, REQ-048)*

- **AC-076** — Given the `mcp_readonly` role's grants, when a `SELECT`
  query is run as that role against the local `realworld` database, then
  it succeeds and returns data.
- **AC-077** — Given the `mcp_readonly` role's grants, when an
  `INSERT`/`UPDATE`/`DELETE` (or other write/DDL) statement is attempted
  as that role, then it is rejected by the database itself with a
  read-only-transaction error, regardless of what the connecting client
  requests.
- **AC-078** — Given the checked-in `.mcp.json` and the
  `MCP_PG_READONLY_URL` environment variable exported in the shell, when
  Claude Code starts, then the Postgres MCP server connects successfully
  using only the `mcp_readonly` credential, and no literal credential
  appears in any file tracked by git.
- **AC-079** — Given `.claude/settings.json`, when inspected, then the MCP
  server's tools are absent from any auto-approval allowlist, so the first
  use of the server in a session requires an interactive permission
  prompt.

### US-029 — Edit own comment
*(REQ-049)*

- **AC-080** — Given an authenticated user submitting an edit with an empty
  `body` directly to the API, when submitted, then a field-required error
  is returned and the comment is unchanged.
- **AC-081** — Given an authenticated user submitting an edit for a
  nonexistent comment ID, when submitted, then a not-found error is
  returned.
- **AC-082** — Given the comment's author submits a non-empty body to edit
  the comment, when saved, then the comment's body is updated, and the
  updated text is what is returned on subsequent retrieval of the
  article's comments (not only reflected optimistically in the
  submitting client's own session).
- **AC-083** — Given a user who is not the comment's author, when they
  attempt to edit it, then the request is rejected with an authorization
  (403) error and the comment's body is unchanged.
- **AC-084** — Given no `Authorization` header, when a comment edit is
  attempted, then the request is rejected with an authentication-required
  (401) error.
- **AC-085** — Given a whitespace-only body sent directly to the API to
  edit a comment (bypassing any client-side check), when submitted, then
  the server accepts and applies it, because the server only checks that
  `body` is truthy, not that it contains non-whitespace content (mirroring
  AC-043 for comment creation).

---

## Traceability Matrix

| Requirement | User Story | Acceptance Criteria |
|---|---|---|
| REQ-001 | US-001 | AC-001–AC-006 |
| REQ-002 | US-026 | AC-065 |
| REQ-003 | US-005, US-026 | AC-015, AC-067 |
| REQ-004 | US-004 | AC-014 |
| REQ-005 | US-026 | AC-066 |
| REQ-006 | US-002 | AC-007 |
| REQ-007 | US-002 | AC-008 |
| REQ-008 | US-003 | AC-010, AC-011 |
| REQ-009 | US-002, US-003 | AC-009, AC-012 |
| REQ-010 | US-005, US-006, US-021 | AC-015, AC-016, AC-058 |
| REQ-011 | US-006 | AC-017, AC-018 |
| REQ-012 | US-006 | AC-016 |
| REQ-013 | US-001, US-011 | AC-001, AC-029–AC-031, AC-033 |
| REQ-014 | US-011 | AC-032 |
| REQ-015 | US-007, US-024 | AC-019, AC-020, AC-062 |
| REQ-016 | US-008, US-009, US-020 | AC-024, AC-026, AC-056 |
| REQ-017 | US-008 | AC-022, AC-023 |
| REQ-018 | US-012, US-018 | AC-034, AC-035, AC-051, AC-052 |
| REQ-019 | US-001, US-010 | AC-002, AC-003, AC-027, AC-028 |
| REQ-020 | US-007 | AC-021 |
| REQ-021 | US-001, US-013 | AC-005, AC-039 |
| REQ-022 | US-014 | AC-040, AC-041 |
| REQ-023 | US-016 | AC-045, AC-046 |
| REQ-024 | US-001, US-015 | AC-004, AC-044 |
| REQ-025 | US-017 | AC-047–AC-049 |
| REQ-026 | US-001, US-017, US-019 | AC-006, AC-050, AC-054 |
| REQ-027 | US-018 | AC-051–AC-053 |
| REQ-028 | US-001, US-018, US-019 | AC-006, AC-051, AC-054 |
| REQ-029 | US-004 | AC-013 |
| REQ-030 | US-012 | AC-036, AC-037 |
| REQ-031 | US-011 | AC-033 |
| REQ-032 | US-013 | AC-038 |
| REQ-033 | US-022 | AC-059 |
| REQ-034 | US-014 | AC-042 |
| REQ-035 | US-020 | AC-055 |
| REQ-036 | US-021 | AC-057 |
| REQ-037 | US-025 | AC-063 |
| REQ-038 | US-025 | AC-063, AC-064 |
| REQ-039 | US-024 | AC-061 |
| REQ-040 | US-023 | AC-060 |
| REQ-041 | US-026 | AC-068 |
| REQ-042 | US-016 | AC-069 |
| REQ-043 | US-010 | AC-070 |
| REQ-044 | US-020 | AC-071 |
| REQ-045 | US-002, US-003 | AC-072, AC-073 |
| REQ-046 | US-027 | AC-074, AC-075 |
| REQ-047 | US-028 | AC-076, AC-077 |
| REQ-048 | US-028 | AC-078, AC-079 |
| REQ-049 | US-029 | AC-080–AC-085 |
