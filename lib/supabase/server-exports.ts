// Server-only barrel — safe to import only from Server Components, Server
// Actions, Route Handlers, and other server-side code.
export { createSupabaseServerClient } from './server';
export { createSupabaseAnonClient } from './anon';
export { createSupabaseServiceRoleClient } from './service-role';
export type { Database } from './types';
