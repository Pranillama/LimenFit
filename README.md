# LimenFit

LimenFit is a minimal, high-speed fitness tracker built to prioritize the fastest possible set-logging flow — target: under three seconds per set. The architecture centers on resilient active workout sessions (optimistic UI, offline queuing) and a clean activity history. AI-assisted form analysis is planned for a later phase. The stack is Next.js 15 App Router, React 19, TypeScript strict mode, and Supabase (database + auth + storage).

---

## Required versions

| Tool     | Version                                                                                                                                                                                                                        |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Node     | `>=20` (see `.nvmrc`)                                                                                                                                                                                                          |
| pnpm     | `9.15.0` (pinned via `packageManager` in `package.json`)                                                                                                                                                                       |
| Tailwind | `v3.4.x` (pinned to v3 to match the shadcn `new-york` preset's `tailwind.config.ts` + `@tailwind` directive layout used in this project; v4 with `@theme` in CSS and `@tailwindcss/postcss` is intentionally not adopted here) |

Install pnpm if needed: `corepack enable && corepack prepare pnpm@9.15.0 --activate`

---

## Scripts

| Script              | Description                                                     |
| ------------------- | --------------------------------------------------------------- |
| `pnpm dev`          | Start the Next.js dev server                                    |
| `pnpm build`        | Produce a production build                                      |
| `pnpm start`        | Serve the production build locally                              |
| `pnpm lint`         | Run ESLint across the repo                                      |
| `pnpm lint:fix`     | Run ESLint and auto-fix fixable issues                          |
| `pnpm format`       | Format all files with Prettier                                  |
| `pnpm format:check` | Check formatting without writing                                |
| `pnpm type-check`   | Run `tsc --noEmit` (no output files)                            |
| `pnpm db:start`     | Boot the local Supabase stack (Postgres + Auth + Studio + more) |
| `pnpm db:stop`      | Stop the local Supabase stack                                   |
| `pnpm db:reset`     | Re-apply all migrations and seed data against the local DB      |
| `pnpm db:push`      | Apply pending local migrations to the linked remote project     |
| `pnpm db:diff`      | Generate a new migration file from local schema drift           |

---

## Where things live

> **Note:** Route directories without a `page.tsx` or `route.ts` are intentionally inert — Next.js only activates routes when those files exist. Placeholder `README.md` files mark ownership; implementation is listed by ticket.

```
limenfit/
├── app/
│   ├── (auth)/              # Auth routes: sign-in, sign-up, reset — T4
│   ├── (app)/               # Authenticated app shell and pages — T5
│   │   ├── home/            # Home page — T14
│   │   ├── train/           # Active training session — T9
│   │   │   ├── history/     # Workout history — T10
│   │   │   └── plans/       # Training plans list — T11/T12
│   │   └── profile/         # User profile — T15
│   ├── plan/
│   │   └── [slug]/          # Public shareable plan page — T13
│   ├── api/
│   │   ├── workouts/        # Route handler — T7
│   │   ├── workout-exercises/ # Route handler — T7
│   │   ├── sets/            # Route handler — T7
│   │   ├── exercises/       # Route handler — T8
│   │   ├── plans/           # Route handler — T11
│   │   └── settings/        # Route handler — T15
│   ├── fonts.ts             # Inter via next/font (--font-sans variable)
│   ├── layout.tsx           # Root layout with font + CSS-variable wiring
│   ├── providers.tsx        # Client boundary: QueryClientProvider + dev-only Devtools
│   └── page.tsx             # Root landing page — checks session, redirects authenticated users to /home; shows landing UI to anonymous users (T1)
├── components/
│   └── ui/                  # shadcn primitives — current: Button
├── features/
│   ├── workout/             # Workout feature — T6, T9, T10
│   ├── plan/                # Training plan feature — T11, T12, T13
│   ├── exercise-picker/     # Exercise picker — T8
│   └── home/                # Home screen feature — T14
├── hooks/                   # Shared custom React hooks — T5 onwards
├── lib/
│   ├── env.ts               # Zod env validation, fail-fast at import
│   ├── utils/               # General-purpose utilities (cn helper)
│   ├── auth/                # Auth helpers — placeholder session in T1, replaced by real Supabase helper in T4
│   ├── supabase/            # Four typed client factories (server.ts, browser.ts, anon.ts, service-role.ts) + types.ts placeholder — T2
│   ├── idempotency/         # Idempotency key helpers — T7
│   └── schemas/             # Shared Zod schemas — T7, T8, T11, T15
├── middleware.ts             # Auth middleware stub — implemented by T4; public routes (/ and /plan/[slug]) must be excluded from its matcher
├── stores/                  # Zustand stores for client state — T6
├── styles/
│   └── globals.css          # Tailwind layers + shadcn new-york neutral theme variables
├── supabase/                # Supabase source artifacts
│   ├── config.toml          # Supabase CLI project config — T2
│   ├── migrations/          # SQL migrations — T2/T3
│   ├── seed.sql             # Seed data — T3 (empty in T1)
│   └── functions/           # Edge Functions — reserved, not used in Phase 1
├── public/                  # Static assets (favicon.ico + .gitkeep)
├── .github/
│   └── workflows/           # CI/CD pipeline — T16
├── .env.example             # Required environment variables (template)
├── components.json          # shadcn CLI manifest (style, aliases, icon library)
├── Dockerfile               # Portable dev environment — T2/T16
├── eslint.config.mjs
├── next.config.ts
├── package.json
├── postcss.config.mjs       # tailwindcss + autoprefixer
├── tailwind.config.ts       # Tailwind v3 config with shadcn token mapping
├── tsconfig.json
└── README.md
```

---

## Public routes

The following routes are publicly accessible without authentication:

- `/` — landing page placeholder (this ticket, T1).
- `/plan/[slug]` — public shareable plan page (T13).

The T4 implementer must ensure both routes bypass auth checks. The two recommended approaches are:

- **Omit them from `config.matcher`** — middleware only runs on paths listed in the matcher, so leaving `/` and `/plan/[slug]` out means the middleware never executes for those requests.
- **Use a negative-lookahead matcher** — write a single regex pattern that matches all paths *except* `/` and `/plan/:slug`, e.g. `/((?!plan/).*)` extended to exclude the root.

Alternatively, the middleware function itself may early-return `NextResponse.next()` when `req.nextUrl.pathname` matches those paths, but the matcher-exclusion approach is preferred because it avoids running middleware code at all.

---

## Environment variables

Copy `.env.example` to `.env.local` and fill in the values before running the dev server.

| Variable | Required | Description |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anon/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes (server) | Service role key — never exposed to the browser |
| `NODE_ENV` | No | Defaults to `development` |

`lib/env.ts` validates all variables at import time and throws a single readable error listing every missing or invalid variable. The server variables are guarded by a browser Proxy that throws if accessed in client bundles.

Removing `NEXT_PUBLIC_SUPABASE_URL` (or running with no `.env.local`) causes any module that imports `lib/env` to throw the readable Zod schema error at import time, listing every missing or invalid variable. The current `app/page.tsx` deliberately does **not** import `lib/env` (directly or transitively), so the landing page continues to render even without environment variables — only modules that actually need env will fail. As of T2, all four modules under `lib/supabase/` import `@/lib/env`, so any Server Component, Route Handler, or client bundle that transitively imports a Supabase client factory will now fail at boot if a required env var is missing. The T1 prediction that “T4 will introduce the first real consumer via `lib/supabase/server`” is now satisfied earlier by T2.

---

## Local Supabase backend

The local backend (Postgres, Auth, Studio, Storage, Inbucket) is managed entirely by the Supabase CLI through Docker. There is no custom `docker-compose.yml` in this repo — `pnpm db:start` is the single command to bring everything up. Production Docker assets are owned by T16.

First-time setup:

1. Install and start **Docker Desktop**.
2. Run `pnpm db:start` — the CLI boots the stack and prints the local API URL and anon key when ready.
3. Copy the printed `API URL` and `anon key` values into `.env.local` (also set `SUPABASE_SERVICE_ROLE_KEY` from the printed service role key).
4. Run `pnpm dev`.

```bash
# Requires Docker Desktop to be running
pnpm db:start   # boots the local stack; prints connection URLs when ready
pnpm db:stop    # shuts it down and releases ports
pnpm db:reset   # re-runs all migrations + seed.sql (wipes local data)
```

See `supabase/README.md` for the full workflow including migration verification.

---

## Adding shadcn components

Future contributors should run the following to add new primitives:

```bash
pnpm dlx shadcn@latest add <component>
```

`components.json` already encodes the project conventions (style: `new-york`, CSS variables, neutral base color, `@/components/ui` alias), so the CLI will place files correctly without additional flags.

---

## Phase 1 runtime libraries

The following packages were installed in Phase 1. Most are reserved for later tickets and are unused in the current codebase.

| Package                                     | Purpose                                                                                                                                                                     | Activated by                                                             |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `zustand ^5`                                | Client state management                                                                                                                                                     | T6 `useActiveWorkoutStore`, T15 settings wiring                          |
| `@tanstack/react-query ^5`                  | Server-state fetching, caching, invalidation                                                                                                                                | Active: `QueryClientProvider` in `app/providers.tsx`; query hooks in T5+ |
| `react-hook-form ^7`                        | Form state and validation                                                                                                                                                   | T4 auth forms, T5+ feature forms                                         |
| `zod ^3`                                    | Schema validation and type inference                                                                                                                                        | lib/env.ts (T1), T4 form schemas                                         |
| `@hookform/resolvers ^3`                    | RHF ↔ Zod adapter                                                                                                                                                           | T4 onwards, alongside `react-hook-form`                                  |
| `framer-motion ^11`                         | Declarative animation primitives                                                                                                                                            | T5+ UI animation                                                         |
| `recharts ^2`                               | Chart components — **installed but unused in Phase 1**, reserved for T18 Progress Engine (ticket:75146556-4dd0-418c-9f5e-1d0fc95d0981/2e98b1cb-c672-40ac-aa46-b4aa597a8603) | T18                                                                      |
| `@tanstack/react-query-devtools ^5` _(dev)_ | Floating devtools panel — dynamically imported via `next/dynamic`, excluded from production bundles                                                                         | Dev server only                                                          |

React Query Devtools are loaded via `next/dynamic` with `{ ssr: false }` and are **only included in non-production bundles**. The `process.env.NODE_ENV !== 'production'` guard is statically inlined by Next.js, so the devtools chunk is dead-code-eliminated in `pnpm build`.

---

## Phase 3 expansion (informational)

When the CV microservice lands in Phase 3, the repository will graduate to a monorepo layout with `apps/web/` and `apps/form-analysis/`. The Gemini AI wrapper will live at `apps/web/app/api/ai/` and `apps/web/lib/ai/`.

**Do not pre-create an `apps/` directory in Phase 1** — the migration will be handled as a dedicated task when the microservice is ready.

---

## Verifying T2 acceptance

Use this checklist to confirm the T2 acceptance criteria are met:

1. `lib/supabase/browser.ts`, `server.ts`, `anon.ts`, and `service-role.ts` all exist and export their respective typed factory functions.
2. `lib/supabase/types.ts` exports a `Database` type (placeholder `Record<string, unknown>` until T3 schema migrations land).
3. **AC3 — NOT currently satisfied:** AC3 requires all four typed client factories to be importable from `@/lib/supabase`. The current `lib/supabase/index.ts` barrel exports only `createSupabaseBrowserClient` and `Database`. The server, anon, and service-role factories are intentionally absent from this barrel to prevent server secrets leaking into client bundles. They are available from `@/lib/supabase/server-exports` (all three together) or directly from their submodule paths (`@/lib/supabase/server`, `@/lib/supabase/anon`, `@/lib/supabase/service-role`). AC3 remains unmet against `@/lib/supabase` unless a future change re-exports the server-only helpers from `index.ts` with appropriate build-time safety guards (e.g., the `server-only` package).
4. `server.ts`, `anon.ts`, and `service-role.ts` each call `assertServerOnly()` at module evaluation time — importing any of them from a Client Component or the `@/lib/supabase` barrel throws immediately.
5. `pnpm type-check` passes with all four factory return types inferred as `SupabaseClient<Database>`.

---

## Verifying T1 acceptance

Use this checklist to confirm the T1 acceptance criteria are met:

1. `pnpm install` completes without errors.
2. `pnpm dev` starts cleanly with no console warnings; visiting `/` shows the wordmark (`LimenFit`), the verbatim tagline (`Fast workout logging. Soon: AI form analysis.`), and a working `Get Started` CTA pointing to `/auth` (404 expected until T4 lands).
3. Temporarily edit `lib/auth/session.ts` to return a fake `{ userId: 'test' }` — visiting `/` should redirect to `/home` (404 expected until T5). Revert before committing.
4. `pnpm lint`, `pnpm type-check`, `pnpm format:check`, and `pnpm build` all pass.
5. Removing `.env.local` (or omitting `NEXT_PUBLIC_SUPABASE_URL`) leaves `/` rendering, but importing `lib/env` from a REPL or test harness throws the aggregated Zod issue list.
6. The repository tree matches the "Where things live" diagram above.

---

## ESLint note

`@typescript-eslint/parser` and `@typescript-eslint/eslint-plugin` are listed explicitly in `devDependencies` so that any future ad-hoc rule overrides have a stable peer to reference, even though `eslint-config-next/typescript` (bridged via `FlatCompat`) already wires them internally.
