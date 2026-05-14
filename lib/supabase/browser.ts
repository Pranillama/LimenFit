import { createBrowserClient } from '@supabase/ssr';

import { env } from '@/lib/env';

import type { Database } from './types';

export function createSupabaseBrowserClient() {
  return createBrowserClient<Database>(
    env.client.NEXT_PUBLIC_SUPABASE_URL,
    env.client.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}
