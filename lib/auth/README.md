# lib/auth

This folder was originally scoped in T4 to hold a shared session helper module. After review, the decision was made to rely exclusively on the typed Supabase client factories in `lib/supabase/` rather than a separate session abstraction layer.

**Current contract:**
- Server-side auth: call `createSupabaseServerClient()` from `lib/supabase/server` and use `supabase.auth.getUser()` — never `getSession()`.
- Client-side auth: call `createSupabaseBrowserClient()` from `lib/supabase` for browser interactions.
- Middleware: uses `createServerClient` directly with its own cookie plumbing; calls `supabase.auth.getUser()` for verified auth state.

There is no `session.ts` helper here and none is planned. T4's session-helper deliverable is considered fulfilled by the typed client factories above.
