import { createBrowserClient } from '@supabase/ssr';

import { env } from '@/lib/env';

import type { Database } from './types';

/**
 * Creates a new Supabase browser client.
 *
 * Callers should memoize the returned client per React tree (e.g., via
 * `useState(() => createSupabaseBrowserClient())`) — re-calling this factory
 * creates a new client instance each time.
 */
export function createSupabaseBrowserClient() {
  return createBrowserClient<Database>(
    env.client.NEXT_PUBLIC_SUPABASE_URL,
    env.client.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { isSingleton: false },
  );
}
