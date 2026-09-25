# Requirements

These requirements describe **observable behavior of the current
implementation**, reconstructed from `backend/`, `frontend/`, and the
existing automated tests. Each requirement states what the system does
today, including boundary conditions and special cases already present in
the code. No requirement here describes desired behavior that the current
code does not already exhibit.

---

## Authentication & Session

### REQ-001 — Optional authentication on read endpoints
Requests to endpoints that support anonymous access (article listing, single
article, article comments, user profiles, tags) are processed whether or not
an `Authorization` header is present. When absent, the request proceeds
without a resolved user.

### REQ-002 — Malformed `Authorization` header rejected
If an `Authorization` header is present but splitting its value on a space
does not yield a non-empty token as the second element — e.g., no space is
present at all, or the header ends with a space and nothing follows it —
the request is rejected with a generic server error rather than a specific
authentication error.

### REQ-003 — Authentication required for protected actions
Actions that create, modify, or delete a user's own data (viewing/updating
one's account, creating/updating/deleting an article, creating/deleting a
comment, favoriting/unfavoriting an article, following/unfollowing a user)
require a resolved, authenticated user. When no `Authorization` header was
supplied at all, these actions are rejected with an authentication-required
error.

### REQ-004 — Session tokens do not expire
A session token issued at registration or login remains valid indefinitely;
the system does not enforce any expiration on it.

### REQ-005 — Token with a valid signature but an unresolvable account
If a session token's signature verifies successfully, but no account can be
found matching the token's embedded email, the request-handling code
attempts to report a not-found condition and then, without returning, goes
on to dereference a field of the (unresolved) user object — which raises a
second, unrelated error that is also passed to the error handler. Because
two separate error-handling attempts are triggered for the same request,
the exact HTTP response the caller ultimately receives cannot be reliably
determined from the source alone; confirming it would require observing a
running server. See REQ-041 for the related but distinct case of a token
whose signature does not verify at all, which does not exhibit this
double-error behavior.

---

## Registration & Login

### REQ-006 — Registration requires username, email, and password
Account registration requires non-empty `username`, `email`, and `password`
values. If any is missing, registration is rejected with a field-required
error identifying the first missing field, checked in the order username,
email, password.

### REQ-007 — Registration enforces unique email
Registration is rejected if an account already exists with the submitted
email address. Username is not checked for uniqueness during registration.

### REQ-008 — Login requires a matching email and correct password
Login requires an account to exist with the submitted email; if none exists,
login is rejected. If an account exists but the submitted password does not
match the stored (hashed) password, login is rejected with a generic
"wrong email/password combination" error that does not distinguish which
field was incorrect.

### REQ-009 — Session token issued on successful registration or login
A successful registration or login returns the user's profile data together
with a session token to be used for subsequent authenticated requests.

---

## Account / Profile

### REQ-010 — Account viewing and updating requires authentication
Retrieving or updating the authenticated user's own account requires a
resolved, authenticated user; unauthenticated requests are rejected.

### REQ-011 — Profile update behavior
Updating a user's profile applies each submitted field (username, email,
bio, image) directly to the account, except that any field with an
`undefined` value is left unchanged.

**Special case:** the `password` field is always re-hashed and saved,
regardless of its content — including an empty string. There is no
condition under which a profile update leaves the stored password
unchanged; every account update overwrites the password hash with the hash
of whatever value was submitted in the `password` field (empty string if
none was intentionally provided).

### REQ-012 — Current-user email is sourced from the session token
When returning the authenticated user's own account data, the email address
returned is taken from the session token's contents rather than re-read from
the stored account record on that request.

---

## Articles

### REQ-013 — Article listing supports filtering and pagination
Article listing can be filtered by author username, by tag name, or by the
username of a user who has favorited the articles (mutually independent
filters). Listing supports a page size (`limit`, default 3) and a page index
(`offset`, default 0), and results are ordered newest first.

### REQ-014 — Listing favorites for a nonexistent user fails
Filtering the article list by `favorited=<username>` for a username that
does not correspond to any account results in a server error rather than an
empty list.

### REQ-015 — Article creation requires title, description, body, and a unique slug
Creating an article requires non-empty `title`, `description`, and `body`.
A URL slug is derived automatically from the title. If an article already
exists with the same derived slug, creation is rejected as a duplicate.

### REQ-016 — Only the article's author may update or delete it
Updating or deleting an article is only permitted for the account that
authored it. Any other authenticated account attempting to update or delete
the article is rejected with an authorization error.

### REQ-017 — Updating an article's title regenerates its slug without a uniqueness check
When an article update includes a new `title`, the article's slug is
regenerated from that title and saved. Unlike article creation, this update
path does not check whether the regenerated slug collides with another
existing article's slug.

**Boundary:** `description` and `body` fields on update are only applied
when truthy; a falsy value (e.g., empty string) submitted for `description`
or `body` leaves the existing value unchanged rather than clearing it.

### REQ-018 — Personalized feed is limited to followed authors
The personalized article feed (available only to authenticated users)
returns only articles authored by users the requesting user currently
follows, ordered newest first. If the user follows no one, the feed returns
no articles.

### REQ-019 — Single article retrieval by slug
An article can be retrieved individually by its slug. If no article matches
the given slug, retrieval fails with a not-found error.

---

## Tags

### REQ-020 — Tag attachment/creation rule on article creation
When creating an article with a list of tags, each tag is trimmed and
matched against existing tags by name.

- If a tag with that name already exists, it is attached to the article
  regardless of its length.
- If no tag with that name exists, a new tag is created (using the trimmed
  name) and attached **only if** the original, untrimmed tag string is
  longer than 2 characters. This means the length check counts any
  surrounding whitespace in the submitted tag even though that whitespace
  is stripped before the tag is stored — e.g., a submitted tag of `"  ab"`
  (4 characters including leading whitespace, but `"ab"` after trimming)
  passes the length check and is created, despite trimming to only 2
  characters. New tag names that fail the untrimmed length check are
  silently discarded with no error reported to the caller.

### REQ-021 — Tag listing
The full list of tags can be retrieved without authentication, and is
returned in full without pagination.

---

## Comments

### REQ-022 — Comment creation requires a non-empty body and an existing article
Creating a comment on an article requires a non-empty `body` and requires
the target article (identified by slug) to exist; otherwise the request is
rejected (field-required or not-found, respectively). The submitted body is
only checked for truthiness on the server — a body consisting solely of
whitespace is not rejected server-side.

### REQ-023 — Only the comment's author may delete it
Deleting a comment is only permitted for the account that authored it. Any
other authenticated account attempting to delete the comment is rejected
with an authorization error.

### REQ-024 — Comment listing available without authentication
Retrieving the list of comments for an article does not require
authentication.

---

## Favorites

### REQ-025 — Favoriting/unfavoriting an article requires authentication and an existing article
Favoriting or unfavoriting an article requires a resolved, authenticated
user and requires the target article to exist (identified by slug);
otherwise the request is rejected.

### REQ-026 — Favorite status and count are always represented
Any article representation returned by the API includes a favorite count
(the total number of users who have favorited it) and a favorited flag
indicating whether the requesting user has favorited it. For anonymous
requests, the favorited flag is always `false`, while the favorite count
still reflects the true total.

---

## Follows

### REQ-027 — Following/unfollowing a user requires authentication and an existing target account
Following or unfollowing another user requires a resolved, authenticated
user and requires the target account (identified by username) to exist;
otherwise the request is rejected.

### REQ-028 — Follow status and follower count are always represented
Any user/profile representation returned by the API (standalone profile, or
an article/comment's author) includes a follower count and a following flag
indicating whether the requesting user currently follows that account. For
anonymous requests, the following flag is always `false`, while the
follower count still reflects the true total.

---

## Client Session & Feed Behavior

### REQ-029 — Session persists across page loads
Once a user logs in or registers, their session (credentials header and
profile data) is retained in the browser between page loads/refreshes, so
the user remains signed in without re-entering credentials.

### REQ-030 — Default feed tab selection
On the home page, the initially selected feed tab is "Your Feed" if the
visitor is authenticated, or "Global Feed" if not. The selected tab updates
automatically if the visitor's authentication state changes.

**Boundary:** if the "Your Feed" tab is active while there is no
authenticated session, the article list for that tab is never fetched and
the view remains in a perpetual loading state rather than showing an empty
list or an error.

### REQ-031 — Article list page size
Article listings displayed to the user (home feed, profile articles,
profile favorites) are paginated at 3 articles per page.

### REQ-032 — Popular tags display is limited to 50
The popular-tags sidebar displays at most the first 50 tags returned by the
tag listing, even if more are available.

### REQ-033 — Default avatar for users without a profile image
Any user avatar rendered in the client falls back to a bundled placeholder
image when the user has no profile image set.

### REQ-034 — Client prevents submission of whitespace-only comments
The comment submission form does not send a comment whose text consists
entirely of whitespace; submission is silently skipped in that case.

### REQ-035 — Non-owner is redirected away from the article editor
When a user opens the article editor for an existing article that they are
not the author of, they are redirected away from the editor without seeing
the edit form.

### REQ-036 — Unauthenticated visitor is redirected away from account settings
A visitor without an active session who navigates to the account settings
page is redirected away from that page.

---

## Error Handling

### REQ-037 — Server maps recognized error categories to specific HTTP status codes
The API responds with a specific HTTP status code for each recognized error
category: authentication-required errors as 401, authorization/ownership
errors as 403, not-found errors as 404, and validation errors (including
missing required fields and duplicate values) as 422. Any other error
condition — including malformed input that is not explicitly validated —
results in a 500 response.

### REQ-038 — Client surfaces error messages only for specific response statuses
When an API request fails with an HTTP response status of 401, 403, 404,
422, or 500, the client extracts and surfaces the server's error message to
the calling code. For any other response status, or for a failure with no
HTTP response at all (e.g., a network failure), the error is logged but not
surfaced to the calling code as a thrown error.

*(Directly verified by `frontend/src/helpers/errorHandler.test.js`, which
asserts that the handler throws for each of statuses 401, 403, 404, 422, and
500.)*

---

## Content Formatting

### REQ-039 — Slug normalization
A slug generated from an arbitrary input string is trimmed of leading and
trailing whitespace, converted to lowercase, and has every run of
non-word characters or underscores replaced with a hyphen.

*(Directly verified by `backend/helper/helpers.test.js`, which asserts that
several variations of `"Hello World"` — differing in case, surrounding
whitespace, and underscore-vs-hyphen separators — all normalize to
`"hello-world"`.)*

### REQ-040 — Article/comment date display format
Any displayed creation date (article, comment) is formatted as a full month
name, numeric day, and numeric year (e.g., "January 1, 2020").

*(Directly verified by `frontend/src/helpers/dateFormatter.test.js`.)*

---

## Amendments

The following requirements were added after a documentation review found
special cases present in the code but not yet captured above. Numbering is
appended rather than interleaved so that the original REQ-001–REQ-040
numbering is preserved unchanged.

### REQ-041 — Session token with an invalid or unverifiable signature
If a session token's signature cannot be verified (e.g., it was altered, or
was signed with a different key than the server currently uses), the
request is rejected with a single, generic server error. Unlike REQ-005,
this path does not exhibit double error-handling — the failure is caught
once and reported once.

### REQ-042 — Comment-delete confirmation is not conditioned on authentication state
When an unauthenticated visitor clicks the delete control on a comment, the
client shows a login-required alert but does not stop there: a
delete-confirmation dialog is still presented immediately afterward, and if
confirmed, a delete request is still sent to the server. This differs from
the equivalent article-delete control, which stops immediately after
showing its login-required alert and never presents a confirmation dialog
or sends a request. In both cases the server independently rejects an
unauthenticated delete request (REQ-003), so the comment is not actually
deleted either way — only the client-side dialog sequencing differs.

### REQ-043 — Article detail view can display data without refetching from the server
When the article detail page is opened by following an in-app link from an
article list or preview (which supplies the article's data via client-side
navigation state), the page renders that supplied data directly and does
not request the article from the server again for that page view. If the
page is instead opened without such navigation state (e.g., a direct URL
visit or a page reload), it always requests the article from the server. A
narrower version of the same pattern applies to the profile page's author
information, which refetches from the server unless the supplied
navigation state's `bio` value already matches what is displayed.

### REQ-044 — Article editor's ownership check can be bypassed by navigation state
The client-side check that redirects a non-author away from the article
editor (REQ-035) only runs when the editor is opened without pre-supplied
navigation state; when navigation state is present, the client does not
re-fetch the article or re-check authorship before displaying the edit
form. In the application's own navigation flows, state is only ever
supplied by a control that is itself only shown to an article's actual
author, so this path is not reachable by a non-author through normal use of
the application. Regardless of how the editor is reached, the server-side
authorship check (REQ-016) is independent of this client-side check and
still rejects an update submitted by a non-author.

### REQ-045 — Client-side password length validation differs between login and registration
The login form enforces a minimum password length of 5 characters before
allowing submission; the registration form enforces no minimum length on
its password field. Neither the login nor the registration server endpoint
enforces any password length requirement — both only reject an entirely
empty password (REQ-006, REQ-008).

### REQ-046 — Frontend development server binds to all interfaces on port 2224
When started via `npm run dev`, the frontend's Vite development server
listens on port `2224` and binds to all network interfaces (`0.0.0.0`),
rather than its previous configuration (port `3000`, bound to `localhost`
only) — making the dev server reachable from other devices on the local
network. This requirement covers only the development server started via
`npm run dev`; it does not alter the production build/serve path, and the
backend Express server's own listening port and bind address are
unchanged.

---

### REQ-047 — Dedicated read-only Postgres role for MCP diagnostic access
A Postgres role named `mcp_readonly` exists in the local development
database (the `postgres` service in `docker-compose.yml`), provisioned
idempotently via `db/init/01-mcp-readonly-role.sql` — automatically on a
fresh volume (mounted as a `docker-entrypoint-initdb.d` script), or via
`npm run db:mcp-role` against a pre-existing volume. The role is granted
`CONNECT` on the `realworld` database, `USAGE` on the `public` schema, and
`SELECT` only on all tables in that schema — via both a direct grant and
`ALTER DEFAULT PRIVILEGES`, so tables added by future migrations are
covered automatically — with `default_transaction_read_only` set to `on`
for the role. No `INSERT`/`UPDATE`/`DELETE`/DDL privilege is granted, and
the role has no superuser attribute. This requirement does not alter the
existing application role's (`POSTGRES_USER`) privileges, and applies only
to local development — no production database is reachable from this
role.

### REQ-048 — MCP server for read-only local Postgres access
The repository's checked-in `.mcp.json` configures a Postgres MCP server
(`postgres-readonly`) that connects using the `mcp_readonly` role
(REQ-047), with the connection string supplied only via the
`MCP_PG_READONLY_URL` environment variable — no literal credential is
committed to `.mcp.json` or any other tracked file. The server package
(`@ahmetkca/mcp-server-postgres`) is pinned to an exact version in
`package.json`, with its integrity hash captured in `package-lock.json`,
rather than resolved as "latest" at each session start. The server's
tools are not added to any auto-approval allowlist in
`.claude/settings.json`, so the first use of the server in a session
requires the normal Claude Code permission prompt rather than running
unattended.

### REQ-049 — Only the comment's author may edit it
Editing a comment is only permitted for the account that authored it; any
other authenticated account attempting to edit the comment is rejected
with an authorization error, mirroring the existing deletion rule
(REQ-023). Editing requires a non-empty `body` and requires the target
comment (identified by ID) to exist; otherwise the request is rejected
(field-required or not-found, respectively). As with comment creation
(REQ-022), the submitted body is only checked for truthiness on the
server — a body consisting solely of whitespace is not rejected
server-side. An unauthenticated request to edit a comment is rejected
with an authentication-required error. A successful edit persists the
updated body, so it is reflected on subsequent retrieval of the article's
comments, not only in the submitting client's own session.

### REQ-050 — Article listing can be sorted by favorite count
The article listing endpoint (`GET /api/articles`, `allArticles`,
REQ-013) accepts a `sort` parameter. When `sort=favorites` is given,
results are ordered by favorite count descending, with articles tied on
favorite count ordered newest first as a tie-break. This mode does not
require authentication and is not restricted to followed authors, unlike
the personalized feed (REQ-018). Pagination (`limit`/`offset`, REQ-031)
and the true total (`articlesCount`) behave the same under this sort mode
as under the default order. Any other value of `sort`, or the parameter's
absence, leaves the existing default order (newest first, REQ-013)
unchanged.

**Boundary:** when the `favorited=<username>` filter (REQ-013) is also
present, `sort` has no effect — articles favorited by that user continue
to be returned newest first, regardless of any `sort` value supplied
alongside `favorited`.
