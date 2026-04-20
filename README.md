# LimenFit

LimenFit is a minimal, high-speed fitness tracker built to prioritize the fastest possible set-logging flow — target: under three seconds per set. The architecture centers on resilient active workout sessions (optimistic UI, offline queuing) and a clean activity history. AI-assisted form analysis is planned for a later phase. The stack is Next.js 15 App Router, React 19, TypeScript strict mode, and Supabase (database + auth + storage).

---

## Required versions

| Tool | Version                                                  |
| ---- | -------------------------------------------------------- |
| Node | `>=20` (see `.nvmrc`)                                    |
| pnpm | `9.15.0` (pinned via `packageManager` in `package.json`) |

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

> **Note:** Most folders below are scaffolded in later phases of T1 and populated by the listed tickets. After this bootstrap phase only `app/layout.tsx`, `app/page.tsx`, and the config files at the root exist.

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
│   ├── layout.tsx            # Root layout (placeholder, replaced next phase)
│   └── page.tsx              # Root page (placeholder, replaced next phase)
├── components/              # Shared UI components — T5 onwards
├── features/                # Feature-scoped components and logic — T5 onwards
├── hooks/                   # Shared custom React hooks — T5 onwards
├── lib/
│   └── supabase/            # Supabase client + server helpers — T2
├── stores/                  # Zustand stores for client state — T6
├── styles/                  # Global CSS and design tokens — T1 (styling phase)
├── supabase/                # Supabase migrations and seed — T2 / T3
│   ├── migrations/
│   └── seed.sql
├── public/                  # Static assets
├── .github/
│   └── workflows/           # CI/CD pipeline — T16
├── Dockerfile               # Container image — T2 / T16
├── docker-compose.yml       # Local dev services — T2 / T16
├── eslint.config.mjs
├── next.config.ts
├── package.json
├── tsconfig.json
└── README.md
```

---

## ESLint note

`@typescript-eslint/parser` and `@typescript-eslint/eslint-plugin` are listed explicitly in `devDependencies` so that any future ad-hoc rule overrides have a stable peer to reference, even though `eslint-config-next/typescript` (bridged via `FlatCompat`) already wires them internally.
