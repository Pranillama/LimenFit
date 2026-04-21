/**
 * Temporary session placeholder for Phase 1 (T1).
 *
 * TODO(T4 — ticket:75146556-4dd0-418c-9f5e-1d0fc95d0981/38bb4604-e022-42f2-94c2-bb383d296b29):
 *   Delete this file entirely and replace every caller with the real Supabase
 *   server-side session check from `lib/supabase/server`. The function shape is
 *   kept `async` so call sites do not need updating when the real implementation
 *   is dropped in.
 */

type Session = { userId: string };

export async function getCurrentSessionPlaceholder(): Promise<Session | null> {
  return null;
}
