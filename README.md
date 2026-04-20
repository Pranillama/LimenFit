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

| Script              | Description                            |
| ------------------- | -------------------------------------- |
| `pnpm dev`          | Start the Next.js dev server           |
| `pnpm build`        | Produce a production build             |
| `pnpm start`        | Serve the production build locally     |
| `pnpm lint`         | Run ESLint across the repo             |
| `pnpm lint:fix`     | Run ESLint and auto-fix fixable issues |
| `pnpm format`       | Format all files with Prettier         |
| `pnpm format:check` | Check formatting without writing       |
| `pnpm type-check`   | Run `tsc --noEmit` (no output files)   |

---

## Where things live

> **Note:** Most folders below are scaffolded in later phases of T1 and populated by the listed tickets.

```
limenfit/
├── app/
│   ├── (auth)/              # Auth routes: sign-in, sign-up, reset — T4
│   ├── (app)/               # Authenticated app shell and pages — T5
│   │   ├── home/
│   │   ├── train/
│   │   │   ├── history/
│   │   │   └── plans/
│   │   └── profile/
│   ├── api/                 # Route handlers — T7 (auth), T11 (workouts), T15 (AI)
│   ├── fonts.ts             # Inter via next/font (--font-sans variable)
│   ├── layout.tsx           # Root layout with font + CSS-variable wiring
│   ├── providers.tsx        # Client boundary: QueryClientProvider + dev-only Devtools
│   └── page.tsx             # Root page (Tailwind smoke probe, replaced next phase)
├── components/
│   └── ui/                  # shadcn primitives — current: Button
├── features/                # Feature-scoped components and logic — T5 onwards
├── hooks/                   # Shared custom React hooks — T5 onwards
├── lib/
│   ├── utils.ts             # cn() helper (clsx + tailwind-merge)
│   └── supabase/            # Supabase client + server helpers — T2
├── stores/                  # Zustand stores for client state — T6
├── styles/
│   └── globals.css          # Tailwind layers + shadcn new-york neutral theme variables
├── supabase/                # Supabase migrations and seed — T2 / T3
│   ├── migrations/
│   └── seed.sql
├── public/                  # Static assets
├── .github/
│   └── workflows/           # CI/CD pipeline — T16
├── components.json          # shadcn CLI manifest (style, aliases, icon library)
├── Dockerfile               # Container image — T2 / T16
├── docker-compose.yml       # Local dev services — T2 / T16
├── eslint.config.mjs
├── next.config.ts
├── package.json
├── postcss.config.mjs       # tailwindcss + autoprefixer
├── tailwind.config.ts       # Tailwind v3 config with shadcn token mapping
├── tsconfig.json
└── README.md
```

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
| `zod ^3`                                    | Schema validation and type inference                                                                                                                                        | T2 env schema, T4 form schemas                                           |
| `@hookform/resolvers ^3`                    | RHF ↔ Zod adapter                                                                                                                                                           | T4 onwards, alongside `react-hook-form`                                  |
| `framer-motion ^11`                         | Declarative animation primitives                                                                                                                                            | T5+ UI animation                                                         |
| `recharts ^2`                               | Chart components — **installed but unused in Phase 1**, reserved for T18 Progress Engine (ticket:75146556-4dd0-418c-9f5e-1d0fc95d0981/2e98b1cb-c672-40ac-aa46-b4aa597a8603) | T18                                                                      |
| `@tanstack/react-query-devtools ^5` _(dev)_ | Floating devtools panel — dynamically imported via `next/dynamic`, excluded from production bundles                                                                         | Dev server only                                                          |

React Query Devtools are loaded via `next/dynamic` with `{ ssr: false }` and are **only included in non-production bundles**. The `process.env.NODE_ENV !== 'production'` guard is statically inlined by Next.js, so the devtools chunk is dead-code-eliminated in `pnpm build`.

---

## ESLint note

`@typescript-eslint/parser` and `@typescript-eslint/eslint-plugin` are listed explicitly in `devDependencies` so that any future ad-hoc rule overrides have a stable peer to reference, even though `eslint-config-next/typescript` (bridged via `FlatCompat`) already wires them internally.
