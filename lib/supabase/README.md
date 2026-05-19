# lib/supabase

This directory provides four typed Supabase client factories for use across the Next.js 15 App Router. The **server client** (`createSupabaseServerClient`) reads and writes cookies for session management in Server Components and Route Handlers. The **browser client** (`createSupabaseBrowserClient`) runs in Client Components with a fresh instance per React tree. The **anon client** (`createSupabaseAnonClient`) is a lightweight, session-free client for public unauthenticated reads. The **service-role client** (`createSupabaseServiceRoleClient`) bypasses Row-Level Security entirely and is reserved for privileged server tasks such as cron jobs and internal admin operations.

## Which client do I use?

| Use case | Helper | Module |
| --- | --- | --- |
| Server Component / Route Handler with logged-in user | `createSupabaseServerClient()` | `@/lib/supabase/server` or `@/lib/supabase/server-exports` |
| Client Component (memoize per React tree) | `createSupabaseBrowserClient()` | `@/lib/supabase` |
| Public unauthenticated read (e.g., `/plan/[slug]`) | `createSupabaseAnonClient()` | `@/lib/supabase/anon` or `@/lib/supabase/server-exports` |
| Cron / admin / RLS-bypassing server task | `createSupabaseServiceRoleClient()` | `@/lib/supabase/service-role` or `@/lib/supabase/server-exports` |

> **Memoization note:** `createSupabaseBrowserClient` returns a new instance on every call. Wrap it in `useState(() => createSupabaseBrowserClient())` or an equivalent per-tree strategy to avoid creating redundant clients on re-render.

## Current barrel export surface

There are two barrel files in this directory with distinct import surfaces:

- **`lib/supabase/index.ts`** (`@/lib/supabase`) — client-safe barrel. Exports only `createSupabaseBrowserClient` and the `Database` type. Server-only factories are intentionally absent to prevent accidental bundling into client chunks.
- **`lib/supabase/server-exports.ts`** (`@/lib/supabase/server-exports`) — server-only barrel. Exports `createSupabaseServerClient`, `createSupabaseAnonClient`, `createSupabaseServiceRoleClient`, and `Database`. Safe to import only from Server Components, Server Actions, and Route Handlers.

> **Single-barrel note:** The `@/lib/supabase` barrel (`index.ts`) intentionally exports only `createSupabaseBrowserClient` and `Database` to prevent server secrets from leaking into client bundles. All server-side consumers must import from `@/lib/supabase/server-exports` or the individual submodule paths.

## Database types

The `Database` type used to parameterize all four clients is a generated typed schema surface defined in `lib/supabase/types.ts`, produced by `supabase gen types typescript`. It covers all Phase 1 tables (`exercises`, `workouts`, `workout_exercises`, `sets`, `plans`, `plan_workouts`, `plan_exercises`, `mutation_receipts`, `user_settings`) with full `Row`, `Insert`, and `Update` shapes.

To regenerate after a schema migration:

```bash
pnpm exec supabase gen types typescript --local > lib/supabase/types.ts
```

## Server-only safety

`server.ts`, `anon.ts`, and `service-role.ts` each call `assertServerOnly()` at module evaluation time (imported from `@/lib/env`). This causes an immediate runtime throw if any of these files are bundled into a client chunk — protecting server secrets such as `SUPABASE_SERVICE_ROLE_KEY` from leaking to the browser.

As a result, **these three modules must never be imported from a `'use client'` file, a client component, or the `@/lib/supabase` barrel** (`index.ts`). Import them directly from their submodule path (e.g., `import { createSupabaseServerClient } from '@/lib/supabase/server'`). Only `createSupabaseBrowserClient` is re-exported from the client-safe barrel at `@/lib/supabase`.
