import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  PENDING_DUPLICATE_KEY,
  PENDING_DUPLICATE_TTL_MS,
  clearPendingDuplicate,
  getPendingDuplicate,
  setPendingDuplicate,
} from '../pendingDuplicate';

class MemoryStorage {
  private store = new Map<string, string>();
  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }
  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }
  removeItem(key: string): void {
    this.store.delete(key);
  }
  clear(): void {
    this.store.clear();
  }
  get length(): number {
    return this.store.size;
  }
  key(): string | null {
    return null;
  }
}

let storage: MemoryStorage;

beforeEach(() => {
  storage = new MemoryStorage();
  vi.stubGlobal('window', { sessionStorage: storage });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('pendingDuplicate', () => {
  it('round-trips a value via set/get', () => {
    const value = {
      shareSlug: 'abc-def-ghi',
      clientMutationId: 'mut-1',
      createdAt: Date.now(),
    };

    setPendingDuplicate(value);

    expect(getPendingDuplicate()).toEqual(value);
  });

  it('writes under the documented key', () => {
    const value = {
      shareSlug: 'abc-def-ghi',
      clientMutationId: 'mut-1',
      createdAt: Date.now(),
    };

    setPendingDuplicate(value);

    expect(storage.getItem(PENDING_DUPLICATE_KEY)).toBe(JSON.stringify(value));
  });

  it('clearPendingDuplicate removes the entry', () => {
    setPendingDuplicate({
      shareSlug: 'abc-def-ghi',
      clientMutationId: 'mut-1',
      createdAt: Date.now(),
    });

    clearPendingDuplicate();

    expect(storage.getItem(PENDING_DUPLICATE_KEY)).toBeNull();
    expect(getPendingDuplicate()).toBeNull();
  });

  it('returns null when nothing is stored', () => {
    expect(getPendingDuplicate()).toBeNull();
  });

  it('returns null when the stored value is older than the TTL', () => {
    setPendingDuplicate({
      shareSlug: 'abc-def-ghi',
      clientMutationId: 'mut-1',
      createdAt: Date.now() - PENDING_DUPLICATE_TTL_MS - 1,
    });

    expect(getPendingDuplicate()).toBeNull();
  });

  it('returns the value when it is exactly at the TTL boundary', () => {
    const createdAt = Date.now() - PENDING_DUPLICATE_TTL_MS;
    setPendingDuplicate({
      shareSlug: 'abc-def-ghi',
      clientMutationId: 'mut-1',
      createdAt,
    });

    const result = getPendingDuplicate();
    expect(result).not.toBeNull();
    expect(result!.createdAt).toBe(createdAt);
  });

  it('returns null when the stored value is malformed JSON', () => {
    storage.setItem(PENDING_DUPLICATE_KEY, '{not json');

    expect(getPendingDuplicate()).toBeNull();
  });

  it('returns null when the stored value is missing required fields', () => {
    storage.setItem(PENDING_DUPLICATE_KEY, JSON.stringify({ shareSlug: 'abc' }));

    expect(getPendingDuplicate()).toBeNull();
  });

  it('returns null when fields have wrong types', () => {
    storage.setItem(
      PENDING_DUPLICATE_KEY,
      JSON.stringify({
        shareSlug: 'abc',
        clientMutationId: 'mut-1',
        createdAt: 'not-a-number',
      }),
    );

    expect(getPendingDuplicate()).toBeNull();
  });

  it('treats a missing window as a no-op', () => {
    vi.stubGlobal('window', undefined);

    expect(getPendingDuplicate()).toBeNull();
    expect(() =>
      setPendingDuplicate({
        shareSlug: 'abc-def-ghi',
        clientMutationId: 'mut-1',
        createdAt: Date.now(),
      }),
    ).not.toThrow();
    expect(() => clearPendingDuplicate()).not.toThrow();
  });
});
