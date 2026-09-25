# User Stories

Each story is written from the perspective of a role that interacts with the
current system and traces to one or more requirements in
[`REQUIREMENTS.md`](./REQUIREMENTS.md). No story introduces behavior beyond
what is stated there.

---

**US-001** — As a visitor, I want to browse articles, tags, profiles, and
comments without logging in, so that I can evaluate the platform before
creating an account.
*Related requirements: REQ-001, REQ-013, REQ-019, REQ-021, REQ-024, REQ-026, REQ-028*

**US-002** — As a visitor, I want to register a new account with a username,
email, and password, so that I can start using the platform under my own
identity.
*Related requirements: REQ-006, REQ-007, REQ-009, REQ-045*

**US-003** — As a returning visitor, I want to log in with my email and
password, so that I can access my existing account.
*Related requirements: REQ-008, REQ-009, REQ-045*

**US-004** — As a logged-in user, I want my session to persist across page
reloads and remain valid over time, so that I don't have to log in
repeatedly.
*Related requirements: REQ-029, REQ-004*

**US-005** — As an account owner, I want protected actions (my own account,
my articles, my comments, favoriting, following) to be rejected when no
credentials are supplied, so that no one else can perform actions tied to
my data without authenticating.
*Related requirements: REQ-003, REQ-010*

**US-006** — As an authenticated user, I want to view and update my account
profile (username, email, bio, image, password), so that I can keep my
account information current.
*Related requirements: REQ-010, REQ-011, REQ-012*

**US-007** — As an author, I want to publish a new article with a title,
description, body, and tags, so that I can share content with other users.
*Related requirements: REQ-015, REQ-020*

**US-008** — As an author, I want to edit my own article's title,
description, or body, so that I can correct or update its content.
*Related requirements: REQ-016, REQ-017*

**US-009** — As an author, I want to delete my own article, so that I can
remove content I no longer want published.
*Related requirements: REQ-016*

**US-010** — As a user, I want to view a single article by its slug, so
that I can read its full content.
*Related requirements: REQ-019, REQ-043*

**US-011** — As a user, I want to browse and filter the article list by
author, tag, or favorited-by user, with pagination, so that I can find
articles relevant to me.
*Related requirements: REQ-013, REQ-014, REQ-031*

**US-012** — As an authenticated user, I want to see a personalized feed of
articles from users I follow, so that I can keep up with authors I'm
interested in.
*Related requirements: REQ-018, REQ-030*

**US-013** — As a user, I want to browse popular tags, so that I can
discover articles by topic.
*Related requirements: REQ-021, REQ-032*

**US-014** — As an authenticated user, I want to comment on an article, so
that I can share my thoughts with other readers.
*Related requirements: REQ-022, REQ-034*

**US-015** — As a visitor, I want to read the comments on an article
without logging in, so that I can see the discussion before deciding to
participate.
*Related requirements: REQ-024*

**US-016** — As a comment author, I want to delete my own comment, so that
I can retract something I posted.
*Related requirements: REQ-023, REQ-042*

**US-017** — As an authenticated user, I want to favorite or unfavorite an
article, so that I can bookmark content I care about.
*Related requirements: REQ-025, REQ-026*

**US-018** — As an authenticated user, I want to follow or unfollow another
user, so that I can curate whose articles appear in my personalized feed.
*Related requirements: REQ-027, REQ-028, REQ-018*

**US-019** — As a user, I want to see accurate favorite and follower counts
on articles and profiles regardless of whether I'm logged in, so that I can
gauge popularity even while browsing anonymously.
*Related requirements: REQ-026, REQ-028*

**US-020** — As an author, I want to be prevented from editing an article
that isn't mine, so that I don't accidentally attempt to change someone
else's content.
*Related requirements: REQ-035, REQ-016, REQ-044*

**US-021** — As a visitor without an account, I want to be redirected away
from the account settings page if I try to access it, so that I'm not shown
a form I can't use.
*Related requirements: REQ-036, REQ-010*

**US-022** — As a user, I want profile pictures to show a default image
when a user hasn't set one, so that the interface remains visually
consistent.
*Related requirements: REQ-033*

**US-023** — As a user, I want article and comment dates to be displayed in
a readable format, so that I can understand when content was posted.
*Related requirements: REQ-040*

**US-024** — As a user, I want article slugs to be generated consistently
from titles, so that article URLs are predictable and duplicate titles are
caught.
*Related requirements: REQ-039, REQ-015*

**US-025** — As a user of the client application, I want failed API
requests to surface a clear error message for common failure conditions, so
that I can understand what went wrong.
*Related requirements: REQ-037, REQ-038*

**US-026** — As a user, I want the system to respond predictably when my
credentials are invalid, malformed, or stale, so that a broken or expired
session doesn't leave requests silently unresolved.
*Related requirements: REQ-002, REQ-003, REQ-005, REQ-041*

---

**US-027** — As a developer running the application locally, I want the
frontend development server to be reachable from other devices on my
local network at a predictable address, so that I can test the app from
other machines during development.
*Related requirements: REQ-046*

---

**US-028** — As a developer diagnosing an issue in this repository, I want
read-only MCP access to the local development database, so that I can
inspect schema and data directly while any accidental write attempt is
blocked at the database level, not just by the tool's own claims.
*Related requirements: REQ-047, REQ-048*

**US-029** — As a comment author, I want to edit my own comment, so that I can
fix a mistake or clarify what I said without deleting the whole comment
and losing the thread position/replies context.
*Related requirements: REQ-049*

**US-030** — As a user, I want to browse articles sorted by how many favorites
they've received, so that I can discover the most well-received content on
the platform.
*Related requirements: REQ-050*