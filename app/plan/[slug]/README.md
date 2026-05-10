# app/plan/[slug]

Unauthenticated public viewer for shared training plans.

- Lives outside the `(app)` route group so it does not pull in `AppShell`.
- Uses `createSupabaseAnonClient()` (server-only barrel) for the plan lookup,
  filtered to `is_public = true` so RLS allows anon reads.
- `dynamic = 'force-dynamic'` and `revalidate = 0` keep the page in sync with
  the latest plan state (the anon client reads no cookies so Next would
  otherwise statically optimize it).
- Slug is validated with `/^[A-Za-z0-9_-]{8,64}$/` before any query; invalid
  slugs and missing plans `notFound()` into `not-found.tsx`.
- Auth state is resolved once on the server via `createSupabaseServerClient()`
  and threaded into `DuplicatePlanButton` via `viewerIsLoggedIn`.
- The `DuplicatePlanButton` calls `useDuplicatePlanMutation` for logged-in
  viewers; for anonymous viewers it stashes a `PendingDuplicate` in
  `sessionStorage` (see `features/plan/lib/pendingDuplicate.ts`) and routes to
  `/auth?next=/train/plans`.
