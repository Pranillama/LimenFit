// Client-safe barrel — do NOT re-export server-only modules here.
// Server-only factories (server, anon, service-role) are available from
// @/lib/supabase/server-exports.
export { createSupabaseBrowserClient } from './browser';
export type { Database } from './types';
