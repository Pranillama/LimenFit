import { createClient } from '@supabase/supabase-js';

import { assertServerOnly, env } from '@/lib/env';

import type { Database } from './types';

assertServerOnly();

/**
 * Bypasses RLS. Use only for cron / privileged server tasks (T3
 * pg_cron-adjacent helpers, internal admin routes). Never expose to the
 * request-bound code path.
 */
export function createSupabaseServiceRoleClient() {
  return createClient<Database>(
    env.client.NEXT_PUBLIC_SUPABASE_URL,
    env.server.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    },
  );
}
