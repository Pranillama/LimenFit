import { createClient } from '@supabase/supabase-js';

import { assertServerOnly, env } from '@/lib/env';

import type { Database } from './types';

assertServerOnly();

export function createSupabaseAnonClient() {
  return createClient<Database>(
    env.client.NEXT_PUBLIC_SUPABASE_URL,
    env.client.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    },
  );
}
