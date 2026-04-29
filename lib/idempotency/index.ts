/**
 * Generates a unique client mutation ID for idempotent API requests.
 * Uses crypto.randomUUID() where available, falling back to Math.random for
 * environments (e.g. older WebViews) that do not expose the Web Crypto API.
 */
export function newClientMutationId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback: RFC 4122 v4-like UUID via Math.random
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
