import { createServerClient } from '@supabase/ssr';
import type { SetAllCookies } from '@supabase/ssr';
import { cookies } from 'next/headers';

import { assertServerOnly, env } from '@/lib/env';

import type { Database } from './types';

assertServerOnly();

export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    env.client.NEXT_PUBLIC_SUPABASE_URL,
    env.client.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: Parameters<SetAllCookies>[0]) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch (error) {
            // Only swallow the expected Next.js RSC error — cookie writes are
            // intentionally read-only in Server Components and this is safe to
            // ignore because the session is still readable. Re-throw everything
            // else so real failures inside Route Handlers and Server Actions
            // remain visible.
            if (
              error instanceof Error &&
              error.message.includes(
                'Cookies can only be modified in a Server Action or Route Handler',
              )
            ) {
              return;
            }
            throw error;
          }
        },
      },
    },
  );
}
