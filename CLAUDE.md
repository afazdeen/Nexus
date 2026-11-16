# CLAUDE.md

A small internal task portal: email/password accounts plus per-user task management (create, edit, delete, change status). It runs **locally only**. Next.js serves both the UI and the API.

## Source of truth

**Follow [implementation_guide.md](implementation_guide.md).** It defines the stack, data model, API contract, file layout, phase order and the code for each file.

- Build **phase by phase, in order**, and run each phase's **Check** before moving on.
- Copy the guide's file paths, names, API shapes and status values exactly.
- If the guide is wrong or a library API has changed, make the smallest fix that works and say what you changed and why. Don't redesign around it.
- Any decision that departs from the guide goes in the README's "Key decisions & trade-offs" section.

## Layout & commands

The Next.js app lives in **`task-portal/`**. Run every npm command from there.

```bash
npm run dev           # http://localhost:3000 (SQLite DB is created and migrated on startup)
npm run lint
npm run build         # also type-checks; must pass before a phase is done
npm run db:generate   # after ANY change to lib/db/schema.ts; commit the drizzle/ output
npm run db:studio     # look at the DB
```

Stack: Next.js 16 (App Router, Route Handlers) · TypeScript (strict) · Tailwind CSS v4 · TanStack Query v5 · Drizzle ORM + SQLite (better-sqlite3) · Zod v4.

## Don't over-engineer

This is a small app. Keep it boring, readable and short.

- **No new dependencies** beyond the guide unless something truly can't be done without one. Ask first.
- **No extra layers:** no repository/service classes, DI, generic CRUD factories, or abstract base handlers. A Route Handler querying Drizzle directly is the intended design.
- **No state libraries** (Redux, Zustand, etc.). Server state lives in TanStack Query; UI state lives in `useState`.
- **No UI kit or form library** (shadcn, MUI, react-hook-form). Use plain Tailwind and native elements (`<dialog>`, `<select>`, `FormData`).
- **No features outside the requirements:** no teams, sharing, roles, OAuth, password reset, pagination, search, i18n, dark mode or websockets. List ideas under "next steps" in the README instead.
- Don't add config, env vars or options "for later". Only `DATABASE_PATH` exists.
- Make a shared helper only when the same code appears **three** times.
- Comments explain **why**, never what. Don't add JSDoc to obvious functions.

## Next.js practices

- App Router only. Use **Server Components** by default. Add `'use client'` only on components that need state, effects, event handlers or TanStack Query, and keep those as far down the tree as practical.
- The backend is **Route Handlers** under `app/api/**/route.ts`. Don't use Server Actions; the requirement asks for API routes, and the UI talks to them through TanStack Query.
- In Next 15+ these are **async**: `await cookies()` and `await params` in route handlers.
- Set or delete cookies **only in Route Handlers**, never while a Server Component renders.
- Auth is checked in **three places**: `proxy.ts` (cookie present → UX redirect only), the `(portal)` layout (`getCurrentUser()` → `redirect`), and **every** task handler (`401`). Never rely on the proxy alone.
- Files that touch the DB or sessions (`lib/db/*`, `lib/auth/*`) start with `import 'server-only'`. Client code imports only from `lib/constants.ts`, `lib/validators.ts`, `lib/types.ts`, `lib/api-client.ts` and `hooks/`.
- Use `next/link` for navigation. After login or logout, call `router.replace(...)` and then `router.refresh()`.
- Write Tailwind class names out in full (use lookup maps, never `bg-${x}-50`).

## TypeScript practices

- Keep `strict` on. **No `any`**, no `@ts-ignore` or `@ts-expect-error`, and no non-null `!` unless it's guarded nearby.
- Get types from their source instead of repeating them: `z.infer` / `z.input` for inputs, `typeof table.$inferSelect` for DB rows, `as const` arrays for enums (`TASK_STATUSES` → `TaskStatus`).
- Validate **every** request body and query param with the Zod schemas in `lib/validators.ts`. Never trust or cast `req.json()`.
- Use `import type` for type-only imports.
- Prefer plain functions and object types. Don't add classes; `ApiError` is the only exception.
- Name files in kebab-case (`task-item.tsx`) and use named exports for components. Page and layout files use default exports, because Next requires it.

## Non-negotiables (security & correctness)

- `userId` always comes from the session and is **never** read from the request body.
- Every task query filters by `userId`. A task that belongs to someone else returns **404**.
- Passwords are hashed with scrypt (`lib/auth/password.ts`). Only SHA-256 hashes of session tokens go in the DB. The session cookie is `httpOnly` and `SameSite=Lax`.
- Login returns one generic error: `Invalid email or password`.
- Build the PATCH schema from base fields **with no defaults**. Never use `createTaskSchema.partial()`.
- Clear the TanStack Query cache on logout (`queryClient.clear()`).

## Definition of done (per phase)

1. The phase's **Check** in the guide passes.
2. `npm run lint` and `npm run build` pass with no warnings you introduced.
3. Loading, empty and error states exist for any new UI.
4. Commit only when the user asks.
