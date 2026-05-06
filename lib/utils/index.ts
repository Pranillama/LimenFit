export * from './cn';

/** RFC 4122 v4 UUID. Used to validate route params before Supabase queries. */
export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
