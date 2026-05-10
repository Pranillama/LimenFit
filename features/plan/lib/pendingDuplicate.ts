export const PENDING_DUPLICATE_KEY = 'limenfit:pending-duplicate';
export const PENDING_DUPLICATE_TTL_MS = 30 * 60 * 1000;

export interface PendingDuplicate {
  shareSlug: string;
  clientMutationId: string;
  createdAt: number;
}

export function setPendingDuplicate(value: PendingDuplicate): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(PENDING_DUPLICATE_KEY, JSON.stringify(value));
  } catch {
    // sessionStorage unavailable (private mode quotas, etc.) — silently drop.
  }
}

export function getPendingDuplicate(): PendingDuplicate | null {
  if (typeof window === 'undefined') return null;
  let raw: string | null;
  try {
    raw = window.sessionStorage.getItem(PENDING_DUPLICATE_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  if (
    !parsed ||
    typeof parsed !== 'object' ||
    typeof (parsed as PendingDuplicate).shareSlug !== 'string' ||
    typeof (parsed as PendingDuplicate).clientMutationId !== 'string' ||
    typeof (parsed as PendingDuplicate).createdAt !== 'number'
  ) {
    return null;
  }

  const value = parsed as PendingDuplicate;
  if (Date.now() - value.createdAt > PENDING_DUPLICATE_TTL_MS) {
    return null;
  }
  return value;
}

export function clearPendingDuplicate(): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(PENDING_DUPLICATE_KEY);
  } catch {
    // ignore
  }
}
