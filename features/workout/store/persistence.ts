import type { StateStorage } from 'zustand/middleware';

// Singleton fallback — shared across all storage instances created by this module
const memoryStore = new Map<string, string>();
let _degraded = false;
const degradeListeners = new Set<() => void>();

function markDegraded(): void {
  if (_degraded) return;
  _degraded = true;
  for (const cb of degradeListeners) {
    try {
      cb();
    } catch {
      // swallow listener errors
    }
  }
}

/**
 * Returns a Zustand-compatible StateStorage that writes to localStorage and
 * falls back to an in-memory Map when storage is unavailable.
 *
 * All instances returned by this factory share the same module-level fallback
 * map and degraded flag, so isDegraded() / subscribeDegrade() reflect the
 * global adapter health regardless of which instance triggered the failure.
 */
export function createSafeStorage(): StateStorage {
  return {
    getItem(key: string): string | null {
      if (typeof window === 'undefined') return null;
      // Already degraded: prefer the in-memory value so failed writes stay readable.
      if (_degraded && memoryStore.has(key)) return memoryStore.get(key)!;
      try {
        const value = window.localStorage.getItem(key);
        if (value !== null) {
          // Validate JSON here so createJSONStorage never encounters a parse error.
          try {
            JSON.parse(value);
          } catch {
            markDegraded();
            return memoryStore.get(key) ?? null;
          }
          memoryStore.set(key, value);
          return value;
        }
        return memoryStore.get(key) ?? null;
      } catch {
        markDegraded();
        return memoryStore.get(key) ?? null;
      }
    },

    setItem(key: string, value: string): void {
      if (typeof window === 'undefined') return;
      // Always write to memory first — guarantees getItem() returns the latest
      // value even when localStorage subsequently fails.
      memoryStore.set(key, value);
      try {
        window.localStorage.setItem(key, value);
      } catch (err) {
        if (
          err instanceof DOMException &&
          (err.name === 'QuotaExceededError' ||
            err.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
            err.name === 'SecurityError')
        ) {
          markDegraded();
        } else {
          markDegraded();
        }
      }
    },

    removeItem(key: string): void {
      if (typeof window === 'undefined') return;
      memoryStore.delete(key);
      try {
        window.localStorage.removeItem(key);
      } catch {
        markDegraded();
      }
    },
  };
}

/** True once any setItem / getItem has failed and the adapter degraded. */
export function isDegraded(): boolean {
  return _degraded;
}

/**
 * Registers a callback invoked exactly once when the adapter first degrades.
 * Returns an unsubscribe function.
 */
export function subscribeDegrade(cb: () => void): () => void {
  // If already degraded when subscribing, fire immediately.
  if (_degraded) {
    try {
      cb();
    } catch {
      // swallow
    }
    return () => {};
  }
  degradeListeners.add(cb);
  return () => {
    degradeListeners.delete(cb);
  };
}
