# app/(auth)

Auth surface for LimenFit. Implemented in T4.

## Routes

| Path             | File                     | Purpose                                                          |
| ---------------- | ------------------------ | ---------------------------------------------------------------- |
| `/auth`          | `auth/page.tsx`          | Login / Sign Up card (email+password and Google OAuth)           |
| `/auth/callback` | `auth/callback/route.ts` | OAuth code exchange; redirects to `next` or `/home`              |
| —                | `auth/utils.ts`          | `sanitizeNext` — rejects absolute URLs to prevent open redirects |
| —                | `layout.tsx`             | Centers auth card vertically/horizontally on a full-height page  |

## UI (`AuthCard`)

`features/auth/AuthCard.tsx` renders a tabbed card with two forms:

- **Log In tab** — `signInWithPassword`; on success calls `router.refresh()` then `router.push(next ?? '/home')`.
- **Sign Up tab** — `signUp`; behavior depends on the Supabase config:
  - If the response includes a live session (`data.session != null`, e.g. `enable_confirmations = false`): immediately calls `router.refresh()` then `router.push(next ?? '/home')`.
  - If `data.session` is null (email confirmation required): switches to a "Check your email" screen.
- **Google OAuth** — `signInWithOAuth` redirects to `/auth/callback?next=<path>`.

Server errors surface inline below the form; no toast libraries are used.

## OAuth Callback (`auth/callback/route.ts`)

Exchanges the `code` param for a session via `exchangeCodeForSession`, then redirects to the sanitized `next` param (defaults to `/home`). On any failure, redirects to `/auth?error=oauth_failed`.

## `next` Redirect

The `next` query param threads through every auth path (login, sign-up, Google OAuth) to return the user to the page they originally tried to visit. It is sanitized by `sanitizeNext` to only allow internal paths.

## Protected Routes (see `middleware.ts`)

`middleware.ts` guards `/home`, `/train`, and `/profile` (and all sub-paths). Unauthenticated requests are redirected to `/auth?next=<original-path>`. Public routes (`/auth`, `/`, landing pages) are not matched by the middleware.
