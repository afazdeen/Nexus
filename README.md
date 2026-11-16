# Task Portal

A small internal task portal built with Next.js. A user can create an account, log in and log out, and manage their own task list: create, edit, delete and change the status of tasks. Next.js serves both the UI and the API. Data is stored in a local SQLite file. The project is meant to run locally only.

## Contents

- [Quick start](#quick-start)
- [Features](#features)
- [Tech stack](#tech-stack)
- [Project structure](#project-structure)
- [Data model](#data-model)
- [API](#api)
- [Key technical decisions](#key-technical-decisions)
- [Trade-offs](#trade-offs)
- [Assumptions](#assumptions)
- [Testing](#testing)
- [Future improvements](#future-improvements)

## Quick start

**Requirements:** Node.js **20.9 or newer** (developed and tested on Node 24) and npm. No database server, Docker or environment variables are needed.

```bash
cd task-portal
npm install
npm run dev
```

Open http://localhost:3000. You'll be sent to the login page. Choose **Create one** to register, and you'll land on your task list.

The SQLite database is created at `task-portal/data/app.db` the first time the app starts, and the committed migrations run automatically. To start over with an empty database, stop the server and delete the `task-portal/data/` folder.

### Scripts (run inside `task-portal/`)

| Command | What it does |
|---|---|
| `npm run dev` | Development server on port 3000 |
| `npm run build` / `npm start` | Production build, and serving it |
| `npm test` | Runs the test suite once (Vitest) |
| `npm run test:watch` | Runs the tests in watch mode |
| `npm run lint` | ESLint |
| `npm run db:generate` | Generates a SQL migration after a change to `lib/db/schema.ts` (commit the output in `drizzle/`) |
| `npm run db:studio` | Opens Drizzle Studio to browse the database |

**Optional:** set `DATABASE_PATH` to use a database file somewhere else, for example `DATABASE_PATH=/tmp/demo.db npm run dev`.

**Windows note:** run `npm test` from PowerShell, cmd or the VS Code terminal. In Git Bash, a path with a lowercase drive letter such as `/c/...` triggers a Vitest bug ("failed to find the runner").

## Features

- **Accounts:** register, log in and log out. The task area is protected, so logged-out visitors are sent to `/login`.
- **Tasks:**
  - Each task has a title, an optional description, a status, a priority and an optional due date.
  - You can create, edit and delete tasks. Deleting asks for confirmation.
  - The status changes from a dropdown on each task, and the screen updates immediately.
  - Filter tabs (All / To do / In progress / Done) show live counts.
  - Unfinished tasks past their due date are marked overdue.
- **Feedback:**
  - Loading skeletons, empty states, and error states with Retry.
  - Buttons are disabled while their action is in progress.
  - A dismissible banner appears if a change fails and is rolled back.
  - Field-level validation messages, using the same rules on the client and the server.
- **Accessibility and layout:**
  - Every input has a label, and every control can be reached with Tab.
  - The modal is a native `<dialog>`: focus stays inside while it's open, Esc closes it, and a ✕ button closes it too. Focus returns to whatever opened it.
  - Works at phone width (375 px) without sideways scrolling.

## Tech stack

| Area | Choice |
|---|---|
| Framework | Next.js 16.4 (App Router), React 19.3, TypeScript (strict) |
| Backend | Next.js Route Handlers (`app/api/**/route.ts`) |
| Database | SQLite through `better-sqlite3`, with Drizzle ORM and drizzle-kit migrations |
| Validation | Zod 4, with the same schemas on the client and the server |
| Client data | TanStack Query 5 |
| Styling | Tailwind CSS 4 |
| Tests | Vitest 5 |

## Project structure

```
.
├─ README.md                  ← this file
├─ implementation_guide.md    ← the phase-by-phase build plan the app follows
├─ CLAUDE.md                  ← working rules for the AI coding assistant used on this project
└─ task-portal/               ← the Next.js app
   ├─ app/
   │  ├─ (auth)/              login and register pages (logged-in users are sent to /tasks)
   │  ├─ (portal)/            the protected task area (the layout checks the session)
   │  ├─ api/auth/…           register, login, logout, me
   │  ├─ api/tasks/…          list, create, update, delete
   │  └─ error.tsx            fallback page for unexpected errors
   ├─ components/             auth form, header, task board, task row, task dialog
   ├─ hooks/use-tasks.ts      TanStack Query hooks (fetching and changing tasks)
   ├─ lib/
   │  ├─ db/                  Drizzle schema and connection (runs migrations on startup)
   │  ├─ auth/                password hashing and sessions
   │  ├─ validators.ts        Zod schemas, shared by client and server
   │  └─ api-client.ts        fetch wrapper used by the UI
   ├─ drizzle/                generated SQL migrations (committed)
   ├─ proxy.ts                quick redirect for logged-out visitors (Next 16's name for middleware)
   └─ test/                   shared test helpers
```

## Data model

| Table | Columns | Notes |
|---|---|---|
| `users` | id (UUID), email (unique, stored in lower case), name, password_hash, created_at | |
| `sessions` | id, user_id → users, expires_at, created_at | `id` is the **SHA-256 hash** of the session token; the raw token is never stored |
| `tasks` | id (UUID), user_id → users, title, description?, status, priority, due_date?, created_at, updated_at | Indexed on (user_id, created_at) |

- **Status:** `todo` (the default), `in_progress` or `done`.
- **Priority:** `low`, `medium` (the default) or `high`.
- **Due date:** stored as a plain `YYYY-MM-DD` string.
- **Timestamps:** stored to the millisecond.
- **Cascades:** deleting a user deletes their sessions and tasks. SQLite foreign-key enforcement is switched on explicitly.

## API

All endpoints accept and return JSON. Errors always look like `{ "error": string, "issues"?: { field: string[] } }`.

| Method and path | Auth | Success | Errors |
|---|---|---|---|
| `POST /api/auth/register` `{ name, email, password }` | – | `201 { user }` + session cookie | `400`, `409` email already registered |
| `POST /api/auth/login` `{ email, password }` | – | `200 { user }` + session cookie | `400`, `401` "Invalid email or password" |
| `POST /api/auth/logout` | – | `200 { ok: true }`, cookie cleared | – |
| `GET /api/auth/me` | ✔ | `200 { user }` | `401` |
| `GET /api/tasks?status=` | ✔ | `200 { tasks }`, newest first; the status filter is optional | `401` |
| `POST /api/tasks` | ✔ | `201 { task }` | `400`, `401` |
| `PATCH /api/tasks/:id` (any subset of the fields) | ✔ | `200 { task }` | `400`, `401`, `404` |
| `DELETE /api/tasks/:id` | ✔ | `204` | `401`, `404` |

## Key technical decisions

### Architecture

- **One Next.js app.** Route Handlers are the backend, and the UI calls them through TanStack Query. I chose Route Handlers over Server Actions because the brief asks for API routes. They also give a clear JSON contract that can be tested directly, and they suit optimistic updates on the client.
- **Pages are Server Components by default.** Only interactive pieces are Client Components: forms, the task board and the logout button. The task list loads in the browser, so a loading skeleton appears straight away.
- **Next 16's Cache Components are left on,** as the project generator set them. Pages that depend on the session are rendered on demand. The build and dev mode raise no warnings about this setup.

### Storage

- **SQLite in a single file, through Drizzle ORM.** There's no setup: no database server or Docker, and anyone can run `npm install && npm run dev`. It's still a real relational database, with foreign keys, unique constraints, transactions and indexes. A JSON file would have none of that.
- **Migrations run automatically on startup.** The SQL migrations are committed in `drizzle/` and applied when the app starts, so a fresh clone needs no manual database step. They're safe to run on every start.
- **Due dates are `YYYY-MM-DD` strings,** not timestamps. A due date is a calendar day, not a moment in time, so it never shifts between timezones. The "overdue" check compares against the user's **local** date, not the UTC date.

### Authentication and sessions

- **Sessions are hand-built and stored in the database, not a JWT or an auth library.**
  - Login creates a random 32-byte token and stores only its SHA-256 hash, with a 7-day expiry.
  - The token goes in an `httpOnly`, `SameSite=Lax` cookie. It's also `Secure` in production.
  - Because sessions live in the database, logout really ends them. It's about 100 lines that can be read and tested in full.
- **Passwords are hashed with scrypt from `node:crypto`,** with a random salt per user and constant-time comparison. scrypt is memory-hard and needs no native dependency. A guard rejects malformed stored hashes; without it, the comparison would match two empty values and accept any password.
- **Login has a single generic error, "Invalid email or password".** When the email doesn't exist, the server still computes a hash, so the response time doesn't reveal which emails are registered.
- **Auth is checked in three places:**
  1. `proxy.ts` sends visitors with no session cookie away from `/tasks`. This only improves the experience; it isn't a security check.
  2. The `(portal)` layout validates the session against the database before rendering.
  3. Every task API handler checks the session itself and returns `401` without one.

  This follows Next's own guidance not to rely on middleware for authorisation. The proxy deliberately never redirects *away* from `/login`. Otherwise, an expired cookie would cause a redirect loop.

### Authorisation and validation

- **Every task query is scoped to the logged-in user.** Ownership is checked in the same SQL statement as the update or delete. A task that belongs to someone else returns **404, not 403**, so task IDs can't be discovered.
- **`userId` always comes from the session.** Zod drops unknown fields, so a `userId` sent in a request body is simply ignored.
- **The Zod schemas are shared by the server and the forms,** so the rules and messages are identical everywhere. The update schema is deliberately built **without defaults**. In Zod 4, defaults still apply inside optional fields, so a `PATCH { title }` would otherwise quietly reset the status to `todo`. This is covered by tests at both the schema and the API level.

### Client behaviour

- **Status changes and deletes are optimistic.** The screen updates immediately and rolls back if the server rejects the change, with a banner saying what failed. Creating and editing wait for the server, because they can fail validation and the user needs to see the error in the form.
- **Filtering happens in the browser.** The task list is small, which keeps the tab counts free. The API also supports `?status=` for when pagination is added.
- **An expired session in mid-use** triggers a full page load of `/login`. This also clears any cached data from the old session, and no error flashes during the redirect. Logout clears the query cache as well, so the next person on the same browser never sees the previous user's tasks.
- **The modal uses the native `<dialog>` element,** which provides the focus trap, Esc to close and the backdrop for free. Every way of closing it goes through `dialog.close()`, so the browser returns focus to the button that opened it.

## Trade-offs

| Decision | Benefit | Cost |
|---|---|---|
| SQLite | No setup, a single file, fast | One writer, one machine. Moving to Postgres means swapping the Drizzle driver; the queries stay the same. |
| Sessions in the database instead of JWTs | Logout and expiry really end the session | One indexed database lookup per authenticated request |
| Hand-built auth instead of Auth.js or Better Auth | Small, transparent and fully tested | No OAuth, email verification or password reset out of the box |
| `409 Email already registered` on sign-up | Clear feedback for the user | Reveals whether an email has an account. Login doesn't leak this. |
| CSRF protection from `SameSite=Lax` plus a JSON-only API | No token plumbing | Fine for a local or internal app. A cross-site deployment would want CSRF tokens. |
| Optimistic status changes and deletes | The app feels instant | Rollback logic is needed, and a failed change briefly showed the wrong state |
| Native `confirm()` before deleting | No extra UI code | Plain browser look. An "undo" toast would be friendlier. |
| Edits are last-write-wins | Simple | Two tabs editing the same task can overwrite each other; there's no version check |
| Client-side filtering, no pagination | Simple, with free counts | Doesn't scale to thousands of tasks |
| Changes made while offline are held, not rejected | TanStack Query sends them once the connection returns | While offline, the change shows as applied even though it hasn't been saved yet |
| Few dependencies (no UI kit or form library) | Small and easy to read | Some hand-written markup and validation glue |

## Assumptions

- **Local, single-machine use.** No deployment, HTTPS or horizontal scaling. The `Secure` cookie flag switches on automatically in production builds.
- **Tasks are private to each user.** There's no sharing, teams, roles or admin.
- **Anyone can register with any email.** There's no email verification or invite flow, which is acceptable for a local internal tool.
- **Three fixed statuses** (To do, In progress, Done) are enough to cover "change the status of a task". There's no configurable workflow.
- **Task lists are small,** tens to hundreds of tasks, so there's no pagination.
- **Due dates are calendar days in the user's local timezone.** There are no times or reminders.
- **Modern evergreen browsers** (Chrome, Edge, Firefox, Safari), with JavaScript enabled.
- **The interface is in English only.**
- **Password policy** is 8–128 characters, with no complexity rules.
- **A 7-day session** is acceptable, with no "remember me" option and no sliding expiry.

## Testing

```bash
cd task-portal
npm test
```

There are **181 tests in 13 files**. They run in about 4 seconds against an **in-memory SQLite database**, so `data/app.db` is never touched.

| Layer | What's covered |
|---|---|
| Database | Migrations, WAL mode and foreign keys, defaults, the unique email constraint, cascades, timestamp precision |
| Auth core | scrypt hashing and malformed hashes; session creation, lookup, expiry, cleanup and logout; the cookie flags |
| Validation | Every schema rule and message; the "no defaults on update" pitfall; unknown fields being dropped |
| API (integration) | Every Route Handler called directly: status codes, the error shape, 401s, the generic login error, ownership (404 for other users' tasks), partial updates |
| Route protection | The proxy matcher and redirect; the portal layout rejecting missing or made-up sessions; the auth layout causing no redirect loop |
| UI (render tests) | Loading, empty, error and loaded states; overdue logic (including just after local midnight); disabled states while pending; the dialog's fields, labels and ✕ button; the error page |
| Client | The `api()` wrapper: errors, a 204 response, the 401 redirect that never settles |

Several test suites were also checked by temporarily putting realistic bugs back into the code, such as removing the ownership check or leaking which emails exist, and confirming the right tests fail.

**Not in the automated suite:** typing into forms and clicking through the UI. Those flows were checked in a real (headless) Chrome against the production build during development. The checks covered:
- registering, logging in and out, and the Back button after logout
- creating, editing, changing status and deleting tasks, and the filters
- optimistic updates with added network latency, and rollback on a server 500
- an expired session in mid-use
- Tab and Esc handling, and focus returning after the dialog closes
- 375 px layouts

Those scripts aren't committed; see below.

## Future improvements

**Testing and tooling**
- Add Testing Library with jsdom for component interaction tests, and Playwright for committed end-to-end tests of the main flows. Run lint, type-check and tests in CI.

**Security and accounts**
- Rate limiting and lockout on login and register.
- Password reset, email verification, changing the password, deleting the account.
- Rotate the session on login and on privilege changes, add sliding expiry, and add "log out of all devices".
- CSRF tokens and security headers (such as a Content-Security-Policy) if the app is ever served across sites.

**Tasks**
- Sorting (by due date or priority), search, and pagination on the server.
- Keep the active filter in the URL, so a filtered view can be shared or survives a refresh.
- An undo toast instead of `confirm()` for delete, and a toast system for success and failure messages.
- Optimistic create and edit.
- Version checks so two tabs can't silently overwrite each other's edits.
- A Kanban board view with drag-and-drop between statuses.

**Platform**
- Postgres, plus a Dockerfile or `docker compose`, for a shared or deployed instance.
- Error reporting and structured server logs.
- Dark mode, localisation, and an accessibility audit with real screen readers.
