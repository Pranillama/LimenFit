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
│   ├── (auth)/              # Auth routes: single tabbed /auth page (login + sign-up via AuthCard) and /auth/callback (OAuth code exchange) — T4
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
│   └── page.tsx             # Server Component — checks the Supabase session, redirects authenticated users to /home, otherwise renders the landing page from @/features/landing
├── components/
│   ├── ui/                  # shadcn primitives
│   ├── discard-confirmation-dialog.tsx  # Shared confirmation dialog
│   ├── page-container.tsx   # Shared page container
│   └── page-skeleton.tsx    # Shared page skeleton
├── features/
│   ├── auth/                # Auth forms and UI — T4
│   ├── exercise-picker/     # Exercise picker — T8
│   ├── home/                # Home screen feature — T14
│   ├── landing/             # Public landing page — T17
│   ├── plan/                # Training plan feature — T11, T12, T13
│   ├── profile/             # User profile — T15
│   ├── shell/               # App shell layout — T5
│   └── workout/             # Workout feature — T6, T9, T10
├── hooks/                   # Shared custom React hooks
├── lib/
│   ├── api/                 # Shared API utilities
│   ├── auth/                # Auth helpers
│   ├── env.ts               # Zod env validation, fail-fast at import
│   ├── exercises/           # Exercise-related utilities — T8
│   ├── idempotency/         # Idempotency key helpers — T7
│   ├── plans/               # Plan-related utilities — T11, T12, T13
│   ├── schemas/             # Shared Zod schemas — T7, T8, T11, T15
│   ├── settings/            # Settings utilities — T15
│   ├── supabase/            # Four typed client factories (server.ts, browser.ts, anon.ts, service-role.ts) + types.ts — T2
│   └── utils/               # General-purpose utilities (cn helper)
├── middleware.ts             # Auth middleware — protects /home, /train, and /profile (and their subpaths) via matcher; public routes (/, /auth/*, /plan/[slug]) run without middleware
├── stores/                  # Zustand stores for client state — T6
├── styles/
│   └── globals.css          # Tailwind layers + shadcn new-york neutral theme variables
├── supabase/                # Supabase source artifacts
│   ├── config.toml          # Supabase CLI project config — T2
│   ├── migrations/          # SQL migrations — T2/T3
│   ├── seed.sql             # Seed data — T3 (empty in T1)
│   └── functions/           # Edge Functions — reserved, not used in Phase 1
├── public/                  # Static assets: landing images used by the T17 landing page (hero-athlete.png, fatslogging.png, plansharing.png, aiinsight.png, formanalysis.png, offlinefirst.png, icon.png); metadata icons (favicon, apple-touch-icon) are generated at request time via app/icon.tsx and app/apple-icon.tsx and are not stored here
├── .github/
│   └── workflows/           # CI quality gate (ci.yml) + remote migration (supabase-migrate.yml)
├── .env.example             # Required environment variables (template)
├── components.json          # shadcn CLI manifest (style, aliases, icon library)
├── Dockerfile               # Production Docker image for runtime parity (Vercel deploys via Git integration, not this file)
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

- `/` — Server Component that reads the Supabase session server-side; authenticated users are redirected to `/home`, anonymous users see the landing page rendered from `@/features/landing`.
- `/auth` — single tabbed authentication page (login and sign-up, rendered by `AuthCard`); `/auth/callback` handles OAuth code exchange and redirects to the sanitized `next` param or `/home`.
- `/plan/[slug]` — public shareable plan page (T13).

Authenticated routes (`/home`, `/train`, `/profile`, and their subpaths) are protected by the `matcher`-based pattern in `middleware.ts`. Because the middleware config only lists those specific paths, all public routes above are excluded from middleware execution entirely — the middleware never runs for them.

---

## Environment variables

Copy `.env.example` to `.env.local` and fill in the values before running the dev server.

| Variable                        | Required     | Description                                                                     |
| ------------------------------- | ------------ | ------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | Yes          | Your Supabase project URL                                                       |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes          | Supabase anon/public key                                                        |
| `SUPABASE_SERVICE_ROLE_KEY`     | Yes (server) | Service role key — never exposed to the browser                                 |
| `NEXT_PUBLIC_SITE_URL`          | Yes          | Canonical site URL (no trailing slash) — used by `robots.txt` and `sitemap.xml` |
| `NODE_ENV`                      | No           | Defaults to `development`                                                       |

`lib/env.ts` validates all variables at import time and throws a single readable error listing every missing or invalid variable. The server variables are guarded by a browser Proxy that throws if accessed in client bundles.

Removing `NEXT_PUBLIC_SUPABASE_URL` (or running with no `.env.local`) causes any module that imports `lib/env` to throw the readable Zod schema error at import time, listing every missing or invalid variable. `app/page.tsx` imports `createSupabaseServerClient` from `@/lib/supabase/server-exports`, which imports `@/lib/supabase/server`, which imports `@/lib/env` — so visiting `/` will **not** render without the required env vars present at boot. All four modules under `lib/supabase/` import `@/lib/env`, so any Server Component, Route Handler, or client bundle that transitively imports a Supabase client factory will fail at boot if a required env var is missing.

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

## Deployment

Vercel auto-deploys on every merge to `main`. Pull requests each receive a Vercel Preview deploy. GitHub Actions provide the quality gate but do not perform the deploy — Vercel's Git integration handles all production and preview deployments independently.

### Vercel project settings

| Setting          | Value                                                               |
| ---------------- | ------------------------------------------------------------------- |
| Framework Preset | Next.js                                                             |
| Node version     | 20.x                                                                |
| Package manager  | pnpm 9.15.0 (auto-detected from `packageManager` in `package.json`) |
| Install Command  | `pnpm install --frozen-lockfile`                                    |
| Build Command    | `pnpm build` (default)                                              |
| Output Directory | `.next` (default)                                                   |
| Root Directory   | repo root                                                           |

### Environment variables (Vercel)

Set the following in the Vercel project under **Settings → Environment Variables**, scoped to both **Production** and **Preview**:

| Variable                        | Description                                                                               |
| ------------------------------- | ----------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | Supabase project URL                                                                      |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/public key                                                                  |
| `SUPABASE_SERVICE_ROLE_KEY`     | Service role key — server-only, never exposed to the browser                              |
| `NEXT_PUBLIC_SITE_URL`          | Canonical site URL (e.g. `https://limenfit.com`) — used by `robots.txt` and `sitemap.xml` |

See `.env.example` for the variable names. In CI (`ci.yml`), `pnpm build` runs against placeholder values for these three variables purely to satisfy `lib/env.ts`'s import-time Zod validation — the build step does not connect to Supabase. The values set in Vercel must be the real credentials.

### Docker (optional)

`NEXT_PUBLIC_*` values are inlined into client-side JavaScript bundles by Next.js at `pnpm build` time. Because `.dockerignore` excludes `.env*` files (except `.env.example`), `.env.local` is never present inside the build container — you must pass the public Supabase values as `--build-arg`:

```bash
docker build \
  --build-arg NEXT_PUBLIC_SUPABASE_URL=https://yourproject.supabase.co \
  --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key \
  --build-arg NEXT_PUBLIC_SITE_URL=https://your-domain.com \
  -t limenfit .
```

`SUPABASE_SERVICE_ROLE_KEY` is server-only and never inlined into client bundles, so it can (and should) be supplied at run time — never bake a real service-role key into a build layer:

```bash
docker run --env SUPABASE_SERVICE_ROLE_KEY=your-key -p 3000:3000 limenfit
```

The `Dockerfile` packages the production Next.js build for runtime parity — useful for smoke-testing the production bundle locally. It is not the deployment mechanism (Vercel handles that via its Git integration). For the local Supabase backend, see `pnpm db:start` above — that is owned by T2 and is entirely separate from Docker deployment.

---

## Migration workflow (remote)

The `pnpm db:start` / `db:reset` scripts in T2 are local-only: they target the Docker-backed Supabase instance on your machine. Production migrations run through a separate path.

**Automated (recommended):** `.github/workflows/supabase-migrate.yml` triggers on push to `main` whenever any of the following paths change:

- `supabase/migrations/**`
- `supabase/seed.sql`
- `supabase/config.toml`

The workflow runs `supabase db push` against the remote project using the secrets below.

### Required GitHub repository secrets

| Secret                  | Source                                                                 |
| ----------------------- | ---------------------------------------------------------------------- |
| `SUPABASE_ACCESS_TOKEN` | Supabase dashboard → Account → Access Tokens                           |
| `SUPABASE_PROJECT_REF`  | Supabase dashboard → Project → Settings → General → Reference ID       |
| `SUPABASE_DB_PASSWORD`  | Supabase dashboard → Project → Settings → Database → Database password |

### Manual escape hatch

```bash
supabase login
supabase link --project-ref <ref>
pnpm db:push
```

`pnpm db:push` is already wired in `package.json` as `supabase db push`. Use this for one-off fixes or when the automated workflow needs to be bypassed.

### Ordering note

Vercel deploys and the migration workflow run independently in parallel — there is no explicit dependency between them. All current migrations in `supabase/migrations/` are additive (new tables, columns, and indexes only), so this is safe for Phase 1: a deploy landing before a migration means the new schema is not yet visible; a migration landing before a deploy means the app has not yet been updated to use it — neither causes data loss or errors.

If a future migration introduces a breaking schema change (e.g., dropping a column the current app reads), the parallel assumption breaks. Mitigation options at that point:

- **Separate PRs:** merge the migration ahead of the dependent app code in its own PR, confirming the remote schema is updated before the app code lands.
- **Deploy hook:** introduce a Vercel deploy hook that waits for the migration workflow job to succeed before triggering a production deploy.

This is a forward-looking note for Phase 2+, not an action item for Phase 1.

---

## CI/CD pipelines

Two GitHub Actions workflows manage automation for this repository.

### `ci.yml` — quality gate (PRs and pushes to `main`)

Runs on every pull request and every push to `main`. Steps: install dependencies (`pnpm install --frozen-lockfile`), ESLint lint, Prettier format check, TypeScript type check (`tsc --noEmit`), Vitest test suite, and `pnpm build`. All six steps must pass before a PR can be merged.

The build step runs with placeholder values for all required build-time variables (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and `NEXT_PUBLIC_SITE_URL`) to satisfy `lib/env.ts`'s Zod validation without a real Supabase project or domain.

### `supabase-migrate.yml` — remote migration (push to `main`)

Path-filtered: only triggers when `supabase/migrations/**`, `supabase/seed.sql`, or `supabase/config.toml` changes on `main`. Runs `supabase db push` against the linked remote project. Requires `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_REF`, and `SUPABASE_DB_PASSWORD` as repository secrets (see [Migration workflow (remote)](#migration-workflow-remote) above).

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
2. `pnpm dev` starts cleanly with no console warnings; visiting `/` renders the landing page (shipped in T17) with a `Get Started` CTA that links to `/auth`.
3. Sign in via `/auth` with a real Supabase account and navigate to `/` — `app/page.tsx` checks the session server-side and redirects authenticated users to `/home`.
4. `pnpm lint`, `pnpm type-check`, `pnpm format:check`, and `pnpm build` all pass.
5. Any module that imports `lib/env` directly or transitively — including `app/page.tsx` via `lib/supabase/server-exports` → `lib/supabase/server` → `lib/env` — will fail to boot if required env vars are missing; the Zod-aggregated error message lists every missing variable.
6. The repository tree matches the "Where things live" diagram above.

---

## ESLint note

`@typescript-eslint/parser` and `@typescript-eslint/eslint-plugin` are listed explicitly in `devDependencies` so that any future ad-hoc rule overrides have a stable peer to reference, even though `eslint-config-next/typescript` (bridged via `FlatCompat`) already wires them internally.
