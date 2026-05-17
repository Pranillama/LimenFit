# features/landing

Marketing landing page for unauthenticated visitors (`/`).

## Structure

`LandingPage` is a Server Component composed of six sub-components rendered in order:

| Component            | Description                                                                      |
| -------------------- | -------------------------------------------------------------------------------- |
| `LandingHeader`      | Sticky translucent top bar — wordmark + "Get Started" CTA                        |
| `LandingHero`        | Headline, subheadline, primary/secondary CTAs, illustration slot                 |
| `LandingFeatures`    | 2-column card grid — Fast logging, Offline-first, Plan sharing, AI form analysis |
| `LandingWhyLimenFit` | Short pain/success narrative                                                     |
| `LandingContact`     | Heading + mailto CTA — no form required                                          |
| `LandingFooter`      | Grouped link columns + copyright row                                             |

## Content

All copy and link data lives in `lib/content.ts`. Update `GITHUB_URL` and `CONTACT_EMAIL` before launch (marked with TODO comments).

Privacy and Terms footer links point to `#` placeholders until those pages exist.

## Illustration slots

Each section reserves placeholder `<div data-slot="…" />` elements where Phase B SVG illustrations will mount. No illustrations or animations are included here.

## Routing

`app/page.tsx` remains the only entry point. It server-redirects authenticated users to `/home` before rendering `<LandingPage />` for guests — this feature folder contains no routing logic of its own.

## Icons / favicon

App icons are generated via `next/og` `ImageResponse` in the App Router's [Metadata Files convention](https://nextjs.org/docs/app/api-reference/file-conventions/metadata):

| File                 | Size    | Purpose                                           |
| -------------------- | ------- | ------------------------------------------------- |
| `app/icon.tsx`       | 32×32   | Browser tab favicon (`<link rel="icon">`)         |
| `app/apple-icon.tsx` | 180×180 | iOS home screen (`<link rel="apple-touch-icon">`) |

Both render a serif "L" on a dark background (`#18181b`, matching `--primary: 240 5.9% 10%` from `styles/globals.css`). No static `favicon.ico` — the `.tsx` convention supersedes it and keeps the icon in version control as code.
