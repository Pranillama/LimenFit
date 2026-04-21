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

> **AC3 status (T2):** AC3 — "all four typed client factories are importable from `@/lib/supabase`" — is **not currently satisfied**. The `@/lib/supabase` barrel (`index.ts`) intentionally exports only the browser factory to avoid server-secret leakage into client bundles. If AC3 requires the single barrel to cover all four factories, a runtime change must re-export the server, anon, and service-role helpers from `lib/supabase/index.ts` — but this is unsafe without additional guards (e.g., `server-only` package or a build-time boundary). Use `@/lib/supabase/server-exports` for server-side consumers in the meantime.

## Database types

The `Database` type used to parameterize all four clients is a placeholder defined in `lib/supabase/types.ts`:

```ts
export type Database = Record<string, unknown>;
```

It will be replaced by the output of `supabase gen types typescript` in T3, once the schema migrations are established.

## Server-only safety

`server.ts`, `anon.ts`, and `service-role.ts` each call `assertServerOnly()` at module evaluation time (imported from `@/lib/env`). This causes an immediate runtime throw if any of these files are bundled into a client chunk — protecting server secrets such as `SUPABASE_SERVICE_ROLE_KEY` from leaking to the browser.

As a result, **these three modules must never be imported from a `'use client'` file, a client component, or the `@/lib/supabase` barrel** (`index.ts`). Import them directly from their submodule path (e.g., `import { createSupabaseServerClient } from '@/lib/supabase/server'`). Only `createSupabaseBrowserClient` is re-exported from the client-safe barrel at `@/lib/supabase`.
