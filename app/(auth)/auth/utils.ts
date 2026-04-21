/**
 * Rejects absolute URLs and protocol-relative paths to prevent open redirects.
 * Only permits app-internal paths that start with a single '/'.
 */
export function sanitizeNext(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  if (value.startsWith('/') && !value.startsWith('//')) return value;
  return undefined;
}
