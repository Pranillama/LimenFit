import { assertServerOnly } from '@/lib/env';
import { createSupabaseServerClient } from '@/lib/supabase/server-exports';

assertServerOnly();

export class ApiAuthError extends Error {
  constructor(message = 'Unauthorized') {
    super(message);
    this.name = 'ApiAuthError';
  }
}

/**
 * Verifies the session and returns the authenticated user and a scoped Supabase
 * client. Throws ApiAuthError when the session is missing or invalid.
 *
 * Note: middleware.ts does NOT cover /api/* routes, so every route handler must
 * call requireUser() itself rather than relying on middleware enforcement.
 */
export async function requireUser() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw new ApiAuthError();
  }

  return { supabase, user };
}
