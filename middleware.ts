import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(req: NextRequest) {
  // Track pending cookie mutations with full options so redirect and success
  // paths both use the same source, preserving maxAge/expires/path/etc.
  const pendingCookies: Array<{ name: string; value: string; options: Parameters<(typeof NextResponse.prototype.cookies)['set']>[2] }> = [];

  let res = NextResponse.next({
    request: { headers: req.headers },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => req.cookies.set(name, value));
          // Rebuild response with updated request headers so downstream handlers
          // receive the refreshed state on every protected request.
          res = NextResponse.next({ request: { headers: req.headers } });
          cookiesToSet.forEach(({ name, value, options }) => {
            res.cookies.set(name, value, options);
            pendingCookies.push({ name, value, options });
          });
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const pathname = req.nextUrl.pathname;
    const redirectUrl = new URL(`/auth?next=${pathname}`, req.url);
    const redirectRes = NextResponse.redirect(redirectUrl);
    // Forward every pending cookie mutation with its original options so
    // expiry/invalidation semantics are preserved on the redirect response.
    pendingCookies.forEach(({ name, value, options }) => {
      redirectRes.cookies.set(name, value, options);
    });
    return redirectRes;
  }

  await supabase.auth.getSession();

  return res;
}

export const config = {
  matcher: [
    '/home',
    '/home/:path*',
    '/train',
    '/train/:path*',
    '/profile',
    '/profile/:path*',
  ],
};
