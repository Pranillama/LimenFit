/**
 * Reserved for the auth middleware introduced by T4.
 *
 * When T4 implements this file:
 *   - The `/` route and any `/plan/[slug]` routes are public and MUST NOT be
 *     covered by the auth middleware. Because `config.matcher` defines which
 *     paths middleware runs on, these routes must be LEFT OUT of the matcher —
 *     adding them would opt them into auth checks rather than exempting them.
 *     Use a negative-lookahead pattern or an explicit allowlist that omits
 *     these paths, or have the middleware function early-return
 *     `NextResponse.next()` when `req.nextUrl.pathname` matches them.
 *   - Export `const config = { matcher: [...] }` alongside the
 *     `export function middleware(req)` implementation.
 *
 * Until then, no middleware function is exported so Next.js attaches nothing
 * at runtime.
 */

export {};
