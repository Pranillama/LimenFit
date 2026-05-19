# features/landing

Marketing landing page for unauthenticated visitors (`/`).

## Routing

`app/page.tsx` is the sole entry point. It is a Next.js Server Component that:

1. Creates a Supabase server client via `createSupabaseServerClient`.
2. Calls `supabase.auth.getUser()` to check the session server-side.
3. Redirects authenticated users to `/home` via `redirect('/home')`.
4. Renders `<LandingPage />` (imported from `@/features/landing`) for guests.

This feature folder contains no routing logic of its own.

## Page composition

`LandingPage` renders a full-screen dark (`bg-black text-white`) layout. Sections are arranged in this order:

| Component            | Container                            | Description                                                         |
| -------------------- | ------------------------------------ | ------------------------------------------------------------------- |
| `LandingHeader`      | Fixed, full-width                    | Dark navbar — logo, anchor nav, `JoinNow` CTA                       |
| `LandingHero`        | Full-width (outside max-w container) | Full-screen hero with photo background, kinetic headline, marquee   |
| Orange divider       | Full-width `h-px` gradient           | `brand-orange` hairline between hero and features                   |
| `LandingFeatures`    | `max-w-screen-xl` + `MotionSection`  | 5-card bento grid with PNG mockup assets                            |
| `LandingWhyLimenFit` | Full-width                           | Pain/success narrative; "PROGRESS." display word spans the viewport |
| `LandingContact`     | `max-w-screen-xl`                    | Heading + mailto CTA (data from `lib/content.ts`)                   |
| `LandingFooter`      | `max-w-screen-xl`                    | Link columns + copyright (data from `lib/content.ts`)               |

`LandingHero` and `LandingWhyLimenFit` intentionally live outside the `max-w-screen-xl` wrapper so their visuals can span the full viewport width.

## Components

### `LandingHeader`

Client component (`'use client'`).

- Fixed dark navbar (`bg-black/90 backdrop-blur`) with `z-50`.
- Framer Motion `motion.header` slides down from `y: -80` on mount (0.8 s ease-out).
- Desktop: wordmark (Next.js `<Image>` + `/icon.png`), four anchor nav links (`#home`, `#features`, `#why`, `#contact`), and a `JoinNow` link to `/auth`.
- Mobile: hamburger (`Menu` / `X` from `lucide-react`) toggles a dropdown with the same links.

### `LandingHero`

Client component (`'use client'`).

- Full-screen section (`min-h-screen`) with `/hero-athlete.png` as a `fill` background image.
- Responsive gradient overlay: solid `bg-black/65` on mobile; a left-to-right linear gradient on `md+` so the athlete photo shows on the left side.
- **Kinetic rotating word** (`KineticWord`): cycles through `friction.` → `waiting.` → `guessing.` with CSS translate/opacity transitions. Respects `prefers-reduced-motion` via Framer Motion's `useReducedMotion`.
- Staggered entrance animations via inline CSS transitions (stagger offset 0.15 s per element, 50 ms initial delay).
- Primary CTA: "Get Started" → `/auth` (solid `brand-orange` button). Secondary CTA: "See How It Works" → `#features` (outline button).
- **Bottom marquee strip** (`HeroMarquee`): scrolling token strip (`Fast logging`, `Offline-first`, `AI insights`, `Form analysis`, `Plan sharing`, `Open source`) with `brand-orange` bullet separators.

### `LandingFeatures`

Client component (`'use client'`).

- 5-card bento grid: three-column top row on `lg` (Fast logging, Plan sharing, AI insights), two-column bottom row on `md` (Form analysis, Offline-first).
- Each card uses a PNG mockup asset from `/public/` overlaid with a left-edge gradient so text and image blend cleanly.
- Cards animate in via Framer Motion `whileInView` + `whileHover` (`CardMotion`).
- PNG assets: `/fatslogging.png`, `/plansharing.png`, `/aiinsight.png`, `/formanalysis.png`, `/offlinefirst.png`.
- **All copy is component-local** — `LandingFeatures` does not read from `lib/content.ts`.

### `LandingWhyLimenFit`

Full-width section with a large display word and pain/success narrative copy. **All copy is component-local** — `LandingWhyLimenFit` defines its own `WHY` constant and does not import from `lib/content.ts`.

### `LandingContact`

Reads `CONTACT_EMAIL` and `GITHUB_URL` from `lib/content.ts`. Renders a heading and a mailto CTA link.

### `LandingFooter`

Reads `FOOTER_LINKS`, `CONTACT_EMAIL`, and `GITHUB_URL` from `lib/content.ts`. Renders a two-column layout: wordmark + social icons on the left, four `FooterLinkGroup` columns on the right. Privacy and Terms links currently point to `#` placeholders.

### `MotionSection`

Client wrapper component that adds scroll-triggered entrance animation to its children. Used around `LandingFeatures` in `LandingPage`.

### `SystemThemeListener`

Used from `app/layout.tsx` (not from `LandingPage`). Listens for OS `prefers-color-scheme` changes at runtime and applies the `dark` class to `<html>` accordingly.

## Content (`lib/content.ts`)

| Export          | Used by                                                 |
| --------------- | ------------------------------------------------------- |
| `CONTACT_EMAIL` | `LandingContact`, `LandingFooter`                       |
| `GITHUB_URL`    | `LandingContact`, `LandingFooter`                       |
| `FOOTER_LINKS`  | `LandingFooter`                                         |
| `CONTACT`       | Not used by active components — preserved for reference |
| `FEATURES`      | Not used by active components — preserved for reference |
| `HERO`          | Not used by active components — preserved for reference |
| `WHY_LIMENFIT`  | Not used by active components — preserved for reference |

Hero, features, and why-LimenFit copy is **component-local** (each component owns its own constants). `GITHUB_URL` and `CONTACT_EMAIL` are configured at the top of `lib/content.ts`; update them there if the contact endpoints change.

## Assets (`/public/`)

| File                | Used by                          |
| ------------------- | -------------------------------- |
| `/hero-athlete.png` | `LandingHero`                    |
| `/fatslogging.png`  | `LandingFeatures`                |
| `/plansharing.png`  | `LandingFeatures`                |
| `/aiinsight.png`    | `LandingFeatures`                |
| `/formanalysis.png` | `LandingFeatures`                |
| `/offlinefirst.png` | `LandingFeatures`                |
| `/icon.png`         | `LandingHeader`, `LandingFooter` |

## Legacy artifacts

Earlier experimental landing components (`LandingHeroAnimation`, `LandingFeatureGrid`, `components/illustrations/AnalyzeIllustration.tsx`, `components/illustrations/FastLoggingIllustration.tsx`, `components/illustrations/HeroIllustration.tsx`, `components/illustrations/OfflineIllustration.tsx`, `components/illustrations/PlanShareIllustration.tsx`) and the `components/ui/animated-hero-section-1.tsx` prototype have been removed from the repository in favour of the current PNG-based bento implementation. They are no longer present anywhere in the working tree and do not need to be sought out.

## Design tokens

| Token          | Value     | Defined in           |
| -------------- | --------- | -------------------- |
| `brand-orange` | `#e85500` | `tailwind.config.ts` |

`brand-orange` is used for CTAs, nav hover states, kinetic headline text, marquee bullets, feature card icons, and section accent labels throughout the landing page.

## Hydration

`<body suppressHydrationWarning>` in `app/layout.tsx` suppresses the React hydration mismatch that arises from the inline `<script>` that sets `dark` class on `<html>` before first paint.

## Public API (`index.ts`)

```ts
export { LandingPage } from './LandingPage';
export type { FooterLinkGroup } from './lib/content';
```
