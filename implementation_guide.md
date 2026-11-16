# Task Portal — Implementation Guide

A step-by-step guide for building the internal task portal: a single Next.js app that serves the UI and the API, with email/password accounts and per-user task management.

---

## 1. Requirements and how each one is met

| # | Requirement | How it is met |
|---|---|---|
| R1 | Create an account, log in, log out | `/register` and `/login` pages; `POST /api/auth/register`, `/login`, `/logout`; sessions stored in the DB behind an httpOnly cookie |
| R2 | Unauthenticated users cannot reach the task area | Three layers: `proxy.ts` redirect, a server-side check in the portal layout, and a `401` from every task API handler |
| R3 | Show the task list after login | `/tasks` page loads `GET /api/tasks` through TanStack Query |
| R4 | Create a task | "New task" dialog → `POST /api/tasks` |
| R5 | Edit and delete a task | Edit dialog → `PATCH /api/tasks/:id`; delete with confirmation → `DELETE /api/tasks/:id` |
| R6 | Change a task's status | Inline status dropdown → `PATCH /api/tasks/:id` with `{ status }`, applied optimistically |

---

## 2. Tech decisions

| Area | Choice | Reason |
|---|---|---|
| Framework | Next.js 16 (App Router) + TypeScript | Required. Route Handlers (`app/api/**/route.ts`) are the backend |
| Styling | Tailwind CSS v4 | Requested; set up by `create-next-app` |
| Database | SQLite (one file at `data/app.db`) | No setup, a real relational DB, and it suits local-only use |
| ORM | Drizzle ORM + `better-sqlite3` | Lightweight, type-safe, no codegen step, and it can switch to Postgres later |
| Auth | Hand-built sessions stored in the DB | About 100 lines, easy to explain, and logout really ends the session |
| Password hashing | Node's built-in `crypto.scrypt` | Memory-hard, no extra dependency, no native build on Windows |
| Validation | Zod v4 | One set of schemas shared by the API and the forms |
| Client data | TanStack Query v5 | Caching, mutations, optimistic updates |

> **Next.js version note:** In Next.js 16 the middleware file is called `proxy.ts` and exports `proxy()`. On Next.js 15, name it `middleware.ts` and export `middleware()` instead; nothing else changes. In both versions, `cookies()` and the route `params` are **async** and must be awaited.

---

## 3. Data model

### users
| Column | Type | Notes |
|---|---|---|
| id | text (UUID) | PK |
| email | text | unique, stored lower-cased |
| name | text | display name |
| password_hash | text | `salt:hash` (hex, scrypt) |
| created_at | integer (ms timestamp) | |

### sessions
| Column | Type | Notes |
|---|---|---|
| id | text | **SHA-256 of the session token**; the raw token is never stored |
| user_id | text | FK → users.id, `ON DELETE CASCADE` |
| expires_at | integer (ms timestamp) | 7 days after creation |
| created_at | integer (ms timestamp) | |

### tasks
| Column | Type | Notes |
|---|---|---|
| id | text (UUID) | PK |
| user_id | text | FK → users.id, `ON DELETE CASCADE`; tasks belong to one user |
| title | text | required, 1–200 chars |
| description | text, nullable | up to 2000 chars |
| status | text enum | `todo` \| `in_progress` \| `done`, default `todo` |
| priority | text enum | `low` \| `medium` \| `high`, default `medium` |
| due_date | text, nullable | `YYYY-MM-DD`; stored as a plain date string to avoid timezone shifts |
| created_at / updated_at | integer (ms timestamp) | |

Index: `tasks(user_id, created_at)`. The list is sorted newest first.

---

## 4. API contract

All bodies are JSON. Errors always have the shape `{ "error": string, "issues"?: Record<string, string[]> }`.

| Method & path | Auth | Body | Success | Errors |
|---|---|---|---|---|
| `POST /api/auth/register` | — | `{ name, email, password }` | `201 { user }` + session cookie | `400` validation, `409` email taken |
| `POST /api/auth/login` | — | `{ email, password }` | `200 { user }` + session cookie | `400`, `401` invalid credentials |
| `POST /api/auth/logout` | — | — | `200 { ok: true }`, cookie cleared | — |
| `GET /api/auth/me` | ✔ | — | `200 { user }` | `401` |
| `GET /api/tasks?status=` | ✔ | — | `200 { tasks: Task[] }` | `401` |
| `POST /api/tasks` | ✔ | `{ title, description?, status?, priority?, dueDate? }` | `201 { task }` | `400`, `401` |
| `PATCH /api/tasks/:id` | ✔ | any subset of the create fields | `200 { task }` | `400`, `401`, `404` |
| `DELETE /api/tasks/:id` | ✔ | — | `204` | `401`, `404` |

A task that belongs to another user returns **404, not 403**, so users can't find out which task IDs exist.

---

## 5. Project structure

```
task-portal/
├─ app/
│  ├─ layout.tsx                 # root layout, wraps <Providers>
│  ├─ page.tsx                   # redirects to /tasks
│  ├─ providers.tsx              # QueryClientProvider (client)
│  ├─ globals.css                # @import "tailwindcss";
│  ├─ (auth)/
│  │  ├─ layout.tsx              # sends logged-in users to /tasks
│  │  ├─ login/page.tsx
│  │  └─ register/page.tsx
│  ├─ (portal)/
│  │  ├─ layout.tsx              # SERVER auth check + header
│  │  └─ tasks/page.tsx
│  └─ api/
│     ├─ auth/{register,login,logout,me}/route.ts
│     └─ tasks/
│        ├─ route.ts             # GET, POST
│        └─ [id]/route.ts        # PATCH, DELETE
├─ components/
│  ├─ auth-form.tsx
│  ├─ app-header.tsx
│  ├─ logout-button.tsx
│  └─ tasks/
│     ├─ task-board.tsx          # filter tabs + list + dialogs
│     ├─ task-item.tsx
│     ├─ task-form-dialog.tsx
│     └─ status-select.tsx
├─ hooks/use-tasks.ts            # TanStack Query hooks
├─ lib/
│  ├─ constants.ts               # statuses, labels, cookie name (client-safe)
│  ├─ validators.ts              # Zod schemas (client-safe)
│  ├─ types.ts                   # client-side Task type
│  ├─ api-client.ts              # fetch wrapper + ApiError
│  ├─ http.ts                    # server response helpers
│  ├─ db/
│  │  ├─ schema.ts
│  │  └─ index.ts                # connection + auto-migrate
│  └─ auth/
│     ├─ password.ts
│     └─ session.ts
├─ drizzle/                      # generated SQL migrations (commit these)
├─ data/                         # app.db lives here (gitignored)
├─ drizzle.config.ts
├─ proxy.ts
└─ README.md
```

---

## 6. Implementation phases

Build in this order. Each phase can be tested before the next one starts.

### Phase 0 — Scaffold

Create the app in a **subfolder**. `create-next-app` won't scaffold into a folder that already has other files, and the npm package name can't contain capital letters such as `Nexus`.

```bash
cd c:\Afaz\Nexus
npx create-next-app@latest task-portal --ts --tailwind --eslint --app --no-src-dir --import-alias "@/*" --use-npm
cd task-portal

npm i drizzle-orm better-sqlite3 zod @tanstack/react-query server-only
npm i -D drizzle-kit @types/better-sqlite3 @tanstack/react-query-devtools
```

Add these scripts to `package.json`:

```json
"scripts": {
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "lint": "eslint",
  "db:generate": "drizzle-kit generate",
  "db:studio": "drizzle-kit studio"
}
```

Add this to `.gitignore`:

```
/data
```

> **Windows / Node 24:** `better-sqlite3` ships prebuilt binaries, so `npm i` normally works with no compiler. If the install tries to build from source and fails, either install "Desktop development with C++" from the VS Build Tools, or switch the driver to `@libsql/client` with `drizzle-orm/libsql` and `url: "file:./data/app.db"`. That driver is fully prebuilt and the rest of the code stays the same apart from awaiting queries.

**Check:** `npm run dev` serves the default page at http://localhost:3000.

---

### Phase 1 — Database layer

#### `lib/constants.ts` (safe to import from client code)

```ts
export const TASK_STATUSES = ['todo', 'in_progress', 'done'] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_PRIORITIES = ['low', 'medium', 'high'] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export const STATUS_LABELS: Record<TaskStatus, string> = {
  todo: 'To do',
  in_progress: 'In progress',
  done: 'Done',
};

export const PRIORITY_LABELS: Record<TaskPriority, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
};

// Tailwind only picks up class names written out in full, so never build them from pieces.
export const STATUS_STYLES: Record<TaskStatus, string> = {
  todo: 'bg-slate-100 text-slate-700 ring-slate-200',
  in_progress: 'bg-amber-50 text-amber-800 ring-amber-200',
  done: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
};

export const PRIORITY_STYLES: Record<TaskPriority, string> = {
  low: 'text-slate-500',
  medium: 'text-blue-600',
  high: 'text-red-600',
};

export const SESSION_COOKIE = 'session';
```

#### `lib/db/schema.ts`

```ts
import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
import { TASK_STATUSES, TASK_PRIORITIES } from '@/lib/constants';

const id = () => text('id').primaryKey().$defaultFn(() => crypto.randomUUID());
const createdAt = () =>
  integer('created_at', { mode: 'timestamp_ms' }).notNull().$defaultFn(() => new Date());

export const users = sqliteTable('users', {
  id: id(),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  passwordHash: text('password_hash').notNull(),
  createdAt: createdAt(),
});

export const sessions = sqliteTable(
  'sessions',
  {
    id: text('id').primaryKey(), // sha256(token)
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [index('sessions_user_idx').on(t.userId)],
);

export const tasks = sqliteTable(
  'tasks',
  {
    id: id(),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    description: text('description'),
    status: text('status', { enum: TASK_STATUSES }).notNull().default('todo'),
    priority: text('priority', { enum: TASK_PRIORITIES }).notNull().default('medium'),
    dueDate: text('due_date'), // 'YYYY-MM-DD'
    createdAt: createdAt(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull().$defaultFn(() => new Date()),
  },
  (t) => [index('tasks_user_created_idx').on(t.userId, t.createdAt)],
);

export type UserRow = typeof users.$inferSelect;
export type TaskRow = typeof tasks.$inferSelect;
```

#### `drizzle.config.ts`

```ts
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'sqlite',
  schema: './lib/db/schema.ts',
  out: './drizzle',
  dbCredentials: { url: './data/app.db' },
});
```

#### `lib/db/index.ts`

The connection is created once, stored on `globalThis` so hot reload doesn't open new connections, and the committed migrations run on startup. A reviewer then only needs `npm i && npm run dev`.

```ts
import 'server-only';
import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import * as schema from './schema';

const DB_PATH = process.env.DATABASE_PATH ?? path.join(process.cwd(), 'data', 'app.db');

function createDb() {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  const sqlite = new Database(DB_PATH);
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON'); // SQLite enforces FKs only when this is on
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: path.join(process.cwd(), 'drizzle') });
  return db;
}

type Db = ReturnType<typeof createDb>;
const globalForDb = globalThis as unknown as { __db?: Db };

export const db: Db = globalForDb.__db ?? createDb();
if (process.env.NODE_ENV !== 'production') globalForDb.__db = db;
```

Generate the first migration and commit the `drizzle/` folder:

```bash
npm run db:generate
```

Run `npm run db:generate` again after every schema change.

**Check:** run `npm run db:studio` once the app has started. The three tables should exist.

---

### Phase 2 — Auth core

#### `lib/auth/password.ts`

```ts
import { scrypt, randomBytes, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(scrypt) as (pw: string, salt: Buffer, keylen: number) => Promise<Buffer>;
const KEY_LENGTH = 64;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scryptAsync(password, salt, KEY_LENGTH);
  return `${salt.toString('hex')}:${hash.toString('hex')}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [saltHex, hashHex] = stored.split(':');
  if (!saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, 'hex');
  const actual = await scryptAsync(password, Buffer.from(saltHex, 'hex'), expected.length);
  return timingSafeEqual(expected, actual);
}
```

#### `lib/auth/session.ts`

```ts
import 'server-only';
import { cache } from 'react';
import { cookies } from 'next/headers';
import { createHash, randomBytes } from 'node:crypto';
import { and, eq, gt, lt } from 'drizzle-orm';
import { db } from '@/lib/db';
import { sessions, users } from '@/lib/db/schema';
import { SESSION_COOKIE } from '@/lib/constants';

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

export type SessionUser = { id: string; email: string; name: string };

/** Creates a DB session and sets the cookie. Call it from a Route Handler. */
export async function createSession(userId: string): Promise<void> {
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  // Clean up expired sessions on the way in.
  await db.delete(sessions).where(lt(sessions.expiresAt, new Date()));
  await db.insert(sessions).values({ id: hashToken(token), userId, expiresAt });

  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true, // JavaScript can't read it, which limits XSS damage
    sameSite: 'lax', // not sent on cross-site POSTs, which covers CSRF for JSON APIs
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    expires: expiresAt,
  });
}

/** Returns the logged-in user, or null. Called once per request in Server Components thanks to cache(). */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const row = await db
    .select({ id: users.id, email: users.email, name: users.name })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(and(eq(sessions.id, hashToken(token)), gt(sessions.expiresAt, new Date())))
    .get();

  return row ?? null;
});

/** Deletes the session row and clears the cookie. Call it from a Route Handler. */
export async function deleteSession(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) await db.delete(sessions).where(eq(sessions.id, hashToken(token)));
  store.delete(SESSION_COOKIE);
}
```

> Cookies can only be **set or deleted** in Route Handlers, Server Actions or the proxy, never while a Server Component renders. That is why `createSession` and `deleteSession` are only called from API routes.

#### `lib/validators.ts` (shared by server and client)

```ts
import { z } from 'zod';
import { TASK_PRIORITIES, TASK_STATUSES } from '@/lib/constants';

const email = z.string().trim().toLowerCase().pipe(z.email('Enter a valid email address'));

export const registerSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100),
  email,
  password: z.string().min(8, 'Password must be at least 8 characters').max(128),
});

export const loginSchema = z.object({
  email,
  password: z.string().min(1, 'Password is required'),
});

// Base fields have NO defaults on purpose (see the note below).
const taskFields = z.object({
  title: z.string().trim().min(1, 'Title is required').max(200),
  description: z.string().trim().max(2000).nullable(),
  status: z.enum(TASK_STATUSES),
  priority: z.enum(TASK_PRIORITIES),
  dueDate: z.iso.date('Use YYYY-MM-DD').nullable(),
});

export const createTaskSchema = taskFields.extend({
  description: taskFields.shape.description.optional(),
  status: taskFields.shape.status.default('todo'),
  priority: taskFields.shape.priority.default('medium'),
  dueDate: taskFields.shape.dueDate.optional(),
});

export const updateTaskSchema = taskFields
  .partial()
  .refine((v) => Object.keys(v).length > 0, { message: 'Nothing to update' });

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type CreateTaskInput = z.input<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
```

> **Pitfall:** don't build `updateTaskSchema` as `createTaskSchema.partial()`. In Zod v4, defaults still apply inside `.optional()`, so a `PATCH { title }` would quietly reset `status` to `todo`. Keep the base without defaults and add the defaults only for create.

#### `lib/http.ts` (server response helpers)

```ts
import { NextResponse } from 'next/server';
import { z } from 'zod';

export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    return undefined;
  }
}

export const validationError = (error: z.ZodError) =>
  NextResponse.json(
    { error: error.issues[0]?.message ?? 'Validation failed', issues: z.flattenError(error).fieldErrors },
    { status: 400 },
  );

export const unauthorized = () => NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
export const notFound = () => NextResponse.json({ error: 'Not found' }, { status: 404 });
```

---

### Phase 3 — Auth API routes

#### `app/api/auth/register/route.ts`

```ts
import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { hashPassword } from '@/lib/auth/password';
import { createSession } from '@/lib/auth/session';
import { registerSchema } from '@/lib/validators';
import { readJson, validationError } from '@/lib/http';

export async function POST(req: Request) {
  const parsed = registerSchema.safeParse(await readJson(req));
  if (!parsed.success) return validationError(parsed.error);
  const { name, email, password } = parsed.data;

  const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).get();
  if (existing) {
    return NextResponse.json({ error: 'An account with this email already exists' }, { status: 409 });
  }

  const [user] = await db
    .insert(users)
    .values({ name, email, passwordHash: await hashPassword(password) })
    .returning({ id: users.id, name: users.name, email: users.email });

  await createSession(user.id); // log in straight after sign-up
  return NextResponse.json({ user }, { status: 201 });
}
```

#### `app/api/auth/login/route.ts`

```ts
import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { hashPassword, verifyPassword } from '@/lib/auth/password';
import { createSession } from '@/lib/auth/session';
import { loginSchema } from '@/lib/validators';
import { readJson, validationError } from '@/lib/http';

export async function POST(req: Request) {
  const parsed = loginSchema.safeParse(await readJson(req));
  if (!parsed.success) return validationError(parsed.error);
  const { email, password } = parsed.data;

  const user = await db.select().from(users).where(eq(users.email, email)).get();

  // Hash anyway when the user doesn't exist, so the response time doesn't reveal which emails are registered.
  const ok = user ? await verifyPassword(password, user.passwordHash) : (await hashPassword(password), false);

  if (!user || !ok) {
    return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
  }

  await createSession(user.id);
  return NextResponse.json({ user: { id: user.id, name: user.name, email: user.email } });
}
```

#### `app/api/auth/logout/route.ts`

```ts
import { NextResponse } from 'next/server';
import { deleteSession } from '@/lib/auth/session';

export async function POST() {
  await deleteSession();
  return NextResponse.json({ ok: true });
}
```

#### `app/api/auth/me/route.ts`

```ts
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { unauthorized } from '@/lib/http';

export async function GET() {
  const user = await getCurrentUser();
  return user ? NextResponse.json({ user }) : unauthorized();
}
```

**Check (PowerShell `curl.exe` or Git Bash `curl`):**

```bash
curl -i -c jar.txt -H "Content-Type: application/json" \
  -d '{"name":"Ada","email":"ada@example.com","password":"password123"}' \
  http://localhost:3000/api/auth/register          # 201 + Set-Cookie
curl -i -b jar.txt http://localhost:3000/api/auth/me   # 200 { user }
curl -i -b jar.txt -X POST http://localhost:3000/api/auth/logout
curl -i -b jar.txt http://localhost:3000/api/auth/me   # 401
```

---

### Phase 4 — Route protection

#### `proxy.ts` (project root)

This is a quick UX check: if there is **no cookie**, redirect before anything renders. It doesn't query the DB and **is not the security boundary**.

```ts
import { NextResponse, type NextRequest } from 'next/server';
import { SESSION_COOKIE } from '@/lib/constants';

export function proxy(req: NextRequest) {
  if (!req.cookies.has(SESSION_COOKIE)) {
    return NextResponse.redirect(new URL('/login', req.url));
  }
  return NextResponse.next();
}

export const config = { matcher: ['/tasks/:path*'] };
```

#### `app/(portal)/layout.tsx` — the real page-level check

```tsx
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/session';
import { AppHeader } from '@/components/app-header';

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  return (
    <div className="min-h-screen bg-slate-50">
      <AppHeader user={user} />
      <main className="mx-auto max-w-4xl px-4 py-6 sm:px-6">{children}</main>
    </div>
  );
}
```

#### `app/(auth)/layout.tsx`

```tsx
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/session';

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  if (await getCurrentUser()) redirect('/tasks');
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200">{children}</div>
    </div>
  );
}
```

#### `app/page.tsx`

```tsx
import { redirect } from 'next/navigation';
export default function Home() {
  redirect('/tasks');
}
```

> **Pitfall (redirect loop):** don't make the proxy send users *away* from `/login` just because a cookie exists. An expired cookie would then loop: `/login` → proxy → `/tasks` → layout (invalid) → `/login` → … The `(auth)` layout redirects only after `getCurrentUser()` has validated the session against the DB, so there's no loop.

**Check:** with no cookie, `/tasks` redirects to `/login`. With a made-up cookie, the layout redirects to `/login`. Logged in, `/login` redirects to `/tasks`.

---

### Phase 5 — Tasks API

#### `app/api/tasks/route.ts`

```ts
import { NextResponse, type NextRequest } from 'next/server';
import { and, desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/lib/db';
import { tasks } from '@/lib/db/schema';
import { getCurrentUser } from '@/lib/auth/session';
import { createTaskSchema } from '@/lib/validators';
import { TASK_STATUSES } from '@/lib/constants';
import { readJson, unauthorized, validationError } from '@/lib/http';

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  const status = z.enum(TASK_STATUSES).safeParse(req.nextUrl.searchParams.get('status'));
  const where = status.success
    ? and(eq(tasks.userId, user.id), eq(tasks.status, status.data))
    : eq(tasks.userId, user.id);

  const rows = await db.select().from(tasks).where(where).orderBy(desc(tasks.createdAt));
  return NextResponse.json({ tasks: rows });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  const parsed = createTaskSchema.safeParse(await readJson(req));
  if (!parsed.success) return validationError(parsed.error);

  const [task] = await db
    .insert(tasks)
    .values({ ...parsed.data, userId: user.id }) // userId always comes from the session, never from the body
    .returning();

  return NextResponse.json({ task }, { status: 201 });
}
```

#### `app/api/tasks/[id]/route.ts`

```ts
import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { tasks } from '@/lib/db/schema';
import { getCurrentUser } from '@/lib/auth/session';
import { updateTaskSchema } from '@/lib/validators';
import { notFound, readJson, unauthorized, validationError } from '@/lib/http';

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Ctx) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  const { id } = await params;

  const parsed = updateTaskSchema.safeParse(await readJson(req));
  if (!parsed.success) return validationError(parsed.error);

  const [task] = await db
    .update(tasks)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(and(eq(tasks.id, id), eq(tasks.userId, user.id))) // ownership is checked in the same query
    .returning();

  return task ? NextResponse.json({ task }) : notFound();
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  const { id } = await params;

  const deleted = await db
    .delete(tasks)
    .where(and(eq(tasks.id, id), eq(tasks.userId, user.id)))
    .returning({ id: tasks.id });

  return deleted.length ? new NextResponse(null, { status: 204 }) : notFound();
}
```

**Check:** using the cookie jar from Phase 3: create a task, list tasks, PATCH `{"status":"done"}`, then DELETE. Log in as a second user and PATCH the first user's task ID. It should return **404**.

---

### Phase 6 — Frontend foundation

#### `app/providers.tsx`

```tsx
'use client';

import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { ApiError } from '@/lib/api-client';

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,
            // Don't retry 4xx errors; they won't succeed on a second try.
            retry: (count, err) => !(err instanceof ApiError && err.status < 500) && count < 2,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={client}>
      {children}
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}
```

#### `app/layout.tsx` (edit the generated one)

```tsx
import type { Metadata } from 'next';
import './globals.css';
import { Providers } from './providers';

export const metadata: Metadata = { title: 'Task Portal' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased text-slate-900">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
```

#### `lib/api-client.ts`

```ts
export class ApiError extends Error {
  status: number;
  issues?: Record<string, string[]>;
  constructor(status: number, message: string, issues?: Record<string, string[]>) {
    super(message);
    this.status = status;
    this.issues = issues;
  }
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init.headers },
  });

  // If the session expires mid-use, send the user back to login (except on the auth endpoints themselves).
  if (res.status === 401 && !path.startsWith('/api/auth/')) {
    window.location.href = '/login';
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, body.error ?? 'Something went wrong', body.issues);
  }

  return (res.status === 204 ? undefined : await res.json()) as T;
}
```

#### `lib/types.ts`

Dates arrive as ISO strings over JSON, so the client type differs from `TaskRow`.

```ts
import type { TaskPriority, TaskStatus } from '@/lib/constants';

export type Task = {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string | null;
  createdAt: string;
  updatedAt: string;
};
```

#### `hooks/use-tasks.ts`

```ts
'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import type { Task } from '@/lib/types';
import type { CreateTaskInput, UpdateTaskInput } from '@/lib/validators';

export const tasksKey = ['tasks'] as const;

export function useTasks() {
  return useQuery({
    queryKey: tasksKey,
    queryFn: () => api<{ tasks: Task[] }>('/api/tasks').then((r) => r.tasks),
  });
}

export function useCreateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateTaskInput) =>
      api<{ task: Task }>('/api/tasks', { method: 'POST', body: JSON.stringify(input) }).then((r) => r.task),
    onSuccess: () => qc.invalidateQueries({ queryKey: tasksKey }),
  });
}

/** Used for both editing and status changes. Updates the cache optimistically and rolls back on error. */
export function useUpdateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...patch }: UpdateTaskInput & { id: string }) =>
      api<{ task: Task }>(`/api/tasks/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }).then((r) => r.task),
    onMutate: async ({ id, ...patch }) => {
      await qc.cancelQueries({ queryKey: tasksKey });
      const previous = qc.getQueryData<Task[]>(tasksKey);
      qc.setQueryData<Task[]>(tasksKey, (old) => old?.map((t) => (t.id === id ? { ...t, ...patch } : t)));
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(tasksKey, ctx.previous);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: tasksKey }),
  });
}

export function useDeleteTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<void>(`/api/tasks/${id}`, { method: 'DELETE' }),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: tasksKey });
      const previous = qc.getQueryData<Task[]>(tasksKey);
      qc.setQueryData<Task[]>(tasksKey, (old) => old?.filter((t) => t.id !== id));
      return { previous };
    },
    onError: (_err, _id, ctx) => {
      if (ctx?.previous) qc.setQueryData(tasksKey, ctx.previous);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: tasksKey }),
  });
}
```

---

### Phase 7 — Auth pages

One `AuthForm` component handles both modes.

#### `components/auth-form.tsx`

```tsx
'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { api, ApiError } from '@/lib/api-client';
import { loginSchema, registerSchema } from '@/lib/validators';

type Mode = 'login' | 'register';

export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[] | undefined>>({});
  const isRegister = mode === 'register';

  const mutation = useMutation({
    mutationFn: (body: unknown) =>
      api(`/api/auth/${mode}`, { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => {
      router.replace('/tasks');
      router.refresh(); // re-run the server layouts with the new cookie
    },
    onError: (err) => {
      if (err instanceof ApiError && err.issues) setFieldErrors(err.issues);
    },
  });

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const values = Object.fromEntries(new FormData(e.currentTarget));
    const schema = isRegister ? registerSchema : loginSchema;
    const parsed = schema.safeParse(values); // same rules as the server, for instant feedback
    if (!parsed.success) {
      setFieldErrors(parsed.error.flatten().fieldErrors);
      return;
    }
    setFieldErrors({});
    mutation.mutate(parsed.data);
  }

  const formError = mutation.error && !(mutation.error as ApiError).issues ? mutation.error.message : null;

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <h1 className="text-xl font-semibold">{isRegister ? 'Create an account' : 'Sign in'}</h1>

      {formError && (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{formError}</p>
      )}

      {isRegister && <Field name="name" label="Name" autoComplete="name" errors={fieldErrors.name} />}
      <Field name="email" label="Email" type="email" autoComplete="email" errors={fieldErrors.email} />
      <Field
        name="password"
        label="Password"
        type="password"
        autoComplete={isRegister ? 'new-password' : 'current-password'}
        errors={fieldErrors.password}
      />

      <button
        type="submit"
        disabled={mutation.isPending}
        className="w-full rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
      >
        {mutation.isPending ? 'Please wait…' : isRegister ? 'Create account' : 'Sign in'}
      </button>

      <p className="text-center text-sm text-slate-600">
        {isRegister ? 'Already have an account? ' : 'No account yet? '}
        <Link href={isRegister ? '/login' : '/register'} className="font-medium text-slate-900 underline">
          {isRegister ? 'Sign in' : 'Create one'}
        </Link>
      </p>
    </form>
  );
}

function Field({ name, label, errors, ...props }: { name: string; label: string; errors?: string[] } & React.InputHTMLAttributes<HTMLInputElement>) {
  const id = `field-${name}`;
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-sm font-medium text-slate-700">{label}</label>
      <input
        id={id}
        name={name}
        aria-invalid={!!errors?.length}
        aria-describedby={errors?.length ? `${id}-error` : undefined}
        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 aria-[invalid=true]:border-red-500"
        {...props}
      />
      {errors?.[0] && <p id={`${id}-error`} className="text-xs text-red-600">{errors[0]}</p>}
    </div>
  );
}
```

> `error.flatten()` is deprecated in Zod v4 but still works; `z.flattenError(error).fieldErrors` gives the same result.

#### `app/(auth)/login/page.tsx` and `register/page.tsx`

```tsx
import { AuthForm } from '@/components/auth-form';
export default function LoginPage() {
  return <AuthForm mode="login" />;
}
```

```tsx
import { AuthForm } from '@/components/auth-form';
export default function RegisterPage() {
  return <AuthForm mode="register" />;
}
```

#### `components/logout-button.tsx`

```tsx
'use client';

import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';

export function LogoutButton() {
  const router = useRouter();
  const qc = useQueryClient();

  async function logout() {
    await api('/api/auth/logout', { method: 'POST' });
    qc.clear(); // otherwise the next user on this browser could briefly see cached tasks
    router.replace('/login');
    router.refresh();
  }

  return (
    <button onClick={logout} className="rounded-md px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 hover:text-slate-900">
      Log out
    </button>
  );
}
```

#### `components/app-header.tsx`

```tsx
import type { SessionUser } from '@/lib/auth/session';
import { LogoutButton } from './logout-button';

export function AppHeader({ user }: { user: SessionUser }) {
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3 sm:px-6">
        <span className="font-semibold">Task Portal</span>
        <div className="flex items-center gap-3">
          <span className="hidden text-sm text-slate-600 sm:inline">{user.name}</span>
          <LogoutButton />
        </div>
      </div>
    </header>
  );
}
```

> `import type` from `session.ts` is fine inside a Server Component. Never import that module's *values* into a `'use client'` file, because `server-only` will fail the build. This is intentional.

**Check:** register → land on `/tasks`. Log out → land on `/login`. The browser Back button doesn't show the task area again.

---

### Phase 8 — Task UI

#### `app/(portal)/tasks/page.tsx`

```tsx
import { TaskBoard } from '@/components/tasks/task-board';
export default function TasksPage() {
  return <TaskBoard />;
}
```

#### `components/tasks/task-board.tsx`

This component holds the filter tabs with counts, the "New task" button, the list, the loading, empty and error states, and the create/edit dialog.

```tsx
'use client';

import { useMemo, useState } from 'react';
import { useTasks } from '@/hooks/use-tasks';
import { STATUS_LABELS, TASK_STATUSES, type TaskStatus } from '@/lib/constants';
import type { Task } from '@/lib/types';
import { TaskItem } from './task-item';
import { TaskFormDialog } from './task-form-dialog';

type Filter = 'all' | TaskStatus;

export function TaskBoard() {
  const { data: tasks = [], isPending, isError, error, refetch } = useTasks();
  const [filter, setFilter] = useState<Filter>('all');
  const [dialog, setDialog] = useState<{ open: boolean; task?: Task }>({ open: false });

  const counts = useMemo(() => {
    const c: Record<Filter, number> = { all: tasks.length, todo: 0, in_progress: 0, done: 0 };
    tasks.forEach((t) => c[t.status]++);
    return c;
  }, [tasks]);

  const visible = filter === 'all' ? tasks : tasks.filter((t) => t.status === filter);

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">My tasks</h1>
        <button
          onClick={() => setDialog({ open: true })}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          New task
        </button>
      </div>

      <nav className="flex gap-1 overflow-x-auto rounded-lg bg-white p-1 ring-1 ring-slate-200" aria-label="Filter by status">
        {(['all', ...TASK_STATUSES] as Filter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            aria-pressed={filter === f}
            className={`whitespace-nowrap rounded-md px-3 py-1.5 text-sm ${
              filter === f ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            {f === 'all' ? 'All' : STATUS_LABELS[f]} <span className="opacity-70">({counts[f]})</span>
          </button>
        ))}
      </nav>

      {isPending ? (
        <ul className="space-y-2">{[0, 1, 2].map((i) => <li key={i} className="h-20 animate-pulse rounded-lg bg-slate-200" />)}</ul>
      ) : isError ? (
        <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700">
          Couldn&apos;t load tasks: {error.message}{' '}
          <button onClick={() => refetch()} className="font-medium underline">Retry</button>
        </div>
      ) : visible.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 p-10 text-center text-sm text-slate-500">
          {tasks.length === 0 ? 'No tasks yet. Create your first one.' : 'No tasks with this status.'}
        </div>
      ) : (
        <ul className="space-y-2">
          {visible.map((task) => (
            <TaskItem key={task.id} task={task} onEdit={() => setDialog({ open: true, task })} />
          ))}
        </ul>
      )}

      {dialog.open && <TaskFormDialog task={dialog.task} onClose={() => setDialog({ open: false })} />}
    </section>
  );
}
```

#### `components/tasks/status-select.tsx`

```tsx
'use client';

import { STATUS_LABELS, STATUS_STYLES, TASK_STATUSES, type TaskStatus } from '@/lib/constants';
import { useUpdateTask } from '@/hooks/use-tasks';

export function StatusSelect({ id, status }: { id: string; status: TaskStatus }) {
  const update = useUpdateTask();
  return (
    <select
      aria-label="Change status"
      value={status}
      onChange={(e) => update.mutate({ id, status: e.target.value as TaskStatus })}
      className={`rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${STATUS_STYLES[status]}`}
    >
      {TASK_STATUSES.map((s) => (
        <option key={s} value={s}>{STATUS_LABELS[s]}</option>
      ))}
    </select>
  );
}
```

#### `components/tasks/task-item.tsx`

```tsx
'use client';

import { PRIORITY_LABELS, PRIORITY_STYLES } from '@/lib/constants';
import { useDeleteTask } from '@/hooks/use-tasks';
import type { Task } from '@/lib/types';
import { StatusSelect } from './status-select';

export function TaskItem({ task, onEdit }: { task: Task; onEdit: () => void }) {
  const del = useDeleteTask();
  const overdue = task.dueDate && task.status !== 'done' && task.dueDate < new Date().toISOString().slice(0, 10);

  return (
    <li className="flex flex-col gap-3 rounded-lg bg-white p-4 ring-1 ring-slate-200 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 space-y-1">
        <p className={`font-medium ${task.status === 'done' ? 'text-slate-400 line-through' : ''}`}>{task.title}</p>
        {task.description && <p className="line-clamp-2 text-sm text-slate-600">{task.description}</p>}
        <p className="flex gap-3 text-xs">
          <span className={PRIORITY_STYLES[task.priority]}>{PRIORITY_LABELS[task.priority]} priority</span>
          {task.dueDate && <span className={overdue ? 'text-red-600' : 'text-slate-500'}>Due {task.dueDate}</span>}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <StatusSelect id={task.id} status={task.status} />
        <button onClick={onEdit} className="rounded-md px-2 py-1 text-sm text-slate-600 hover:bg-slate-100">Edit</button>
        <button
          onClick={() => confirm(`Delete "${task.title}"?`) && del.mutate(task.id)}
          className="rounded-md px-2 py-1 text-sm text-red-600 hover:bg-red-50"
        >
          Delete
        </button>
      </div>
    </li>
  );
}
```

#### `components/tasks/task-form-dialog.tsx`

One form handles both create (no `task` prop) and edit. It uses the native `<dialog>` element, which gives focus trapping and Esc to close for free.

```tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { useCreateTask, useUpdateTask } from '@/hooks/use-tasks';
import { createTaskSchema } from '@/lib/validators';
import { PRIORITY_LABELS, STATUS_LABELS, TASK_PRIORITIES, TASK_STATUSES } from '@/lib/constants';
import { ApiError } from '@/lib/api-client';
import type { Task } from '@/lib/types';

export function TaskFormDialog({ task, onClose }: { task?: Task; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const create = useCreateTask();
  const update = useUpdateTask();
  const mutation = task ? update : create;
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({});

  useEffect(() => {
    ref.current?.showModal();
  }, []);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const values = {
      title: f.get('title'),
      description: (f.get('description') as string) || null, // empty input → null
      status: f.get('status'),
      priority: f.get('priority'),
      dueDate: (f.get('dueDate') as string) || null,
    };
    const parsed = createTaskSchema.safeParse(values);
    if (!parsed.success) return setErrors(parsed.error.flatten().fieldErrors);

    const options = {
      onSuccess: onClose,
      onError: (err: Error) => err instanceof ApiError && err.issues && setErrors(err.issues),
    };
    if (task) update.mutate({ id: task.id, ...parsed.data }, options);
    else create.mutate(parsed.data, options);
  }

  const input = 'w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-900 focus:outline-none';

  return (
    <dialog ref={ref} onClose={onClose} className="m-auto w-full max-w-md rounded-xl p-0 backdrop:bg-black/40">
      <form onSubmit={onSubmit} noValidate className="space-y-4 p-6">
        <h2 className="text-lg font-semibold">{task ? 'Edit task' : 'New task'}</h2>

        <label className="block space-y-1">
          <span className="text-sm font-medium">Title</span>
          <input name="title" defaultValue={task?.title} autoFocus className={input} />
          {errors.title && <span className="text-xs text-red-600">{errors.title[0]}</span>}
        </label>

        <label className="block space-y-1">
          <span className="text-sm font-medium">Description</span>
          <textarea name="description" rows={3} defaultValue={task?.description ?? ''} className={input} />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="block space-y-1">
            <span className="text-sm font-medium">Status</span>
            <select name="status" defaultValue={task?.status ?? 'todo'} className={input}>
              {TASK_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
            </select>
          </label>
          <label className="block space-y-1">
            <span className="text-sm font-medium">Priority</span>
            <select name="priority" defaultValue={task?.priority ?? 'medium'} className={input}>
              {TASK_PRIORITIES.map((p) => <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>)}
            </select>
          </label>
        </div>

        <label className="block space-y-1">
          <span className="text-sm font-medium">Due date</span>
          <input type="date" name="dueDate" defaultValue={task?.dueDate ?? ''} className={input} />
        </label>

        {mutation.isError && !(mutation.error as ApiError).issues && (
          <p role="alert" className="text-sm text-red-600">{mutation.error.message}</p>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="rounded-md px-4 py-2 text-sm hover:bg-slate-100">Cancel</button>
          <button
            type="submit"
            disabled={mutation.isPending}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
          >
            {mutation.isPending ? 'Saving…' : task ? 'Save changes' : 'Create task'}
          </button>
        </div>
      </form>
    </dialog>
  );
}
```

**Check:** create, edit, change status (the badge updates instantly), delete (with confirmation), and use the filter tabs and their counts.

---

### Phase 9 — Polish checklist

- [ ] Loading skeletons, empty state and error state with retry (included above)
- [ ] Buttons are disabled while their mutation is pending
- [ ] Error banner on login failure (`Invalid email or password`)
- [ ] An expired session in the middle of use → `api()` sends the user to `/login`
- [ ] Keyboard: the dialog closes on Esc, every control is reachable by Tab, inputs have labels
- [ ] Layout works at a phone width of about 375px
- [ ] `npm run lint` and `npm run build` both pass

### Phase 10 (optional) — Automated tests

Use Vitest for the pure logic:

```bash
npm i -D vitest
```

Good targets:
- `hashPassword` / `verifyPassword`: the right password passes, a wrong one fails, and two hashes of the same password differ.
- `updateTaskSchema`: `{ title: 'x' }` does **not** add `status`, and an empty object is rejected.
- `createTaskSchema`: the defaults are applied and a bad `dueDate` is rejected.

Point integration tests at a temporary DB with `DATABASE_PATH`.

---

## 7. Manual acceptance test plan

| # | Steps | Expected |
|---|---|---|
| 1 | Open `/tasks` in a private window | Redirected to `/login` |
| 2 | Register with a bad email or a short password | Field errors appear and no request is sent |
| 3 | Register with valid details | Land on `/tasks` with the empty state |
| 4 | Register again with the same email | "An account with this email already exists" |
| 5 | Create 3 tasks | They appear newest first and the counts update |
| 6 | Edit a task's title and description | Changes show and survive a page refresh |
| 7 | Change a status from the dropdown | Badge updates instantly and survives a refresh |
| 8 | Delete a task and confirm | Task is removed and stays removed after a refresh |
| 9 | Log out, then press Back | The task area isn't shown; you're redirected to `/login` |
| 10 | Log in with a wrong password | "Invalid email or password" |
| 11 | Log in as user B | User A's tasks aren't visible |
| 12 | As B, `curl -X PATCH` one of A's task IDs | `404` |
| 13 | `curl /api/tasks` with no cookie | `401` |
| 14 | Restart `npm run dev` | Data is still there, because SQLite keeps it on disk |

---

## 8. Security notes

| Threat | Mitigation |
|---|---|
| Stolen DB file | Passwords are hashed with scrypt and a per-user salt; only SHA-256 hashes of session tokens are stored |
| XSS reading the session | The cookie is `httpOnly`; React escapes output by default |
| CSRF | `SameSite=Lax` stops browsers sending the cookie on cross-site POST, PATCH and DELETE; the API only accepts JSON |
| Guessing whether an email has an account | Login returns one generic error and a dummy hash keeps the timing the same. Registration does reveal it with a `409`, which is an accepted trade-off for usability |
| Reaching another user's data (IDOR) | Every query filters by `userId` from the session; a task that isn't yours returns `404` |
| Bypassing the proxy | The proxy is only for UX; the real checks are in the layout and in every handler |
| Mass assignment | Zod schemas list exactly which fields are allowed; `userId` is never read from the body |

Out of scope for a local app, but worth listing in the README: login rate limiting, password reset, email verification, rotating sessions on privilege change, and HTTPS (the `secure` cookie flag switches on in production).

---

## 9. README template

The deliverable needs a README covering decisions and trade-offs. Suggested outline:

```markdown
# Task Portal

## Getting started
npm install
npm run dev        # http://localhost:3000 (the DB is created and migrated automatically)

## Features
- Register / log in / log out
- Protected task area
- Create, edit, delete tasks; change status inline; filter by status

## Tech stack
Next.js 16 (App Router, Route Handlers) · TypeScript · Tailwind CSS v4 · TanStack Query v5 ·
Drizzle ORM · SQLite (better-sqlite3) · Zod

## Key decisions & trade-offs
- **SQLite**: no setup for a local-only app, and a real relational DB with FKs and transactions.
  Trade-off: one writer and one machine. Moving to Postgres means swapping the Drizzle driver.
- **Hand-built sessions stored in the DB, not JWTs or an auth library**: small, easy to read, and logout
  really ends the session. Trade-off: one DB lookup per request. Better Auth or Auth.js would suit a
  bigger product (OAuth, email verification, and so on).
- **scrypt from node:crypto**: memory-hard hashing with no native dependency.
- **Three layers of auth**: proxy (UX), server layout (pages), handlers (API). The proxy alone isn't trusted.
- **Route Handlers + TanStack Query rather than Server Actions**: matches the "API routes" requirement
  and makes optimistic status updates easy.
- **Task model**: title, description, status (todo / in_progress / done), priority, due date.
  The fixed statuses keep the UI simple. Due dates are stored as `YYYY-MM-DD` strings to avoid timezone shifts.
- **Tasks are private to each user**: no sharing or teams.
- **404 for tasks you don't own** so task IDs aren't revealed.
- **Filtering on the client**: lists are small. The API also supports `?status=` for when pagination is added.

## Not implemented / next steps
Rate limiting, password reset, email verification, pagination, search, sharing tasks with teams, E2E tests.
```

---

## 10. Common pitfalls

1. **`cookies()` / `params` not awaited.** Both are async in Next 15+.
2. **Setting cookies in a Server Component.** It throws. Do it only in Route Handlers.
3. **`createTaskSchema.partial()` used for PATCH.** Defaults leak into partial updates (see Phase 2).
4. **Proxy redirecting logged-in users away from `/login`.** Causes a redirect loop on expired cookies (see Phase 4).
5. **Forgetting `PRAGMA foreign_keys = ON`.** SQLite ignores FKs without it, so cascades don't run.
6. **Building Tailwind class names from pieces** (`bg-${color}-50`). They get purged. Use full strings from a map.
7. **Not clearing the query cache on logout.** The previous user's tasks flash for the next user.
8. **Importing `lib/db` or `lib/auth/session` into a client component.** `server-only` stops the build. Keep client-safe code in `constants.ts`, `validators.ts` and `types.ts`.
9. **Missing `drizzle/` folder.** Run `npm run db:generate` before the first `npm run dev`, or startup migration fails.
