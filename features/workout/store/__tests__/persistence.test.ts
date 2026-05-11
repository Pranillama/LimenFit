import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { PersistOptions } from 'zustand/middleware';
import type { ActiveWorkoutStoreState } from '../useActiveWorkoutStore';

describe('persistence — safe storage degradation', () => {
  let createSafeStorage: typeof import('../persistence').createSafeStorage;
  let isDegraded: typeof import('../persistence').isDegraded;
  let subscribeDegrade: typeof import('../persistence').subscribeDegrade;

  let mockGetItem: ReturnType<typeof vi.fn>;
  let mockSetItem: ReturnType<typeof vi.fn>;
  let mockRemoveItem: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.resetModules();

    mockGetItem = vi.fn().mockReturnValue(null);
    mockSetItem = vi.fn();
    mockRemoveItem = vi.fn();

    globalThis.window = {
      localStorage: {
        getItem: mockGetItem,
        setItem: mockSetItem,
        removeItem: mockRemoveItem,
      },
    } as unknown as Window & typeof globalThis;

    const mod = await import('../persistence');
    createSafeStorage = mod.createSafeStorage;
    isDegraded = mod.isDegraded;
    subscribeDegrade = mod.subscribeDegrade;
  });

  afterEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (globalThis as any).window;
  });

  it('quota exceeded triggers degradation and fires the listener', () => {
    mockSetItem.mockImplementation(() => {
      throw new DOMException('Quota exceeded', 'QuotaExceededError');
    });

    const listener = vi.fn();
    subscribeDegrade(listener);
    createSafeStorage().setItem('k', '"v"');

    expect(isDegraded()).toBe(true);
    expect(listener).toHaveBeenCalledOnce();
  });

  it('getItem returns the in-memory value after degradation from setItem', () => {
    mockSetItem.mockImplementation(() => {
      throw new DOMException('Quota exceeded', 'QuotaExceededError');
    });

    const storage = createSafeStorage();
    storage.setItem('k', '"v"');

    const value = storage.getItem('k');
    expect(value).toBe('"v"');
  });

  it('generic setItem throw also degrades', () => {
    mockSetItem.mockImplementation(() => {
      throw new Error('disk full');
    });

    const listener = vi.fn();
    subscribeDegrade(listener);
    createSafeStorage().setItem('k', '"v"');

    expect(isDegraded()).toBe(true);
    expect(listener).toHaveBeenCalledOnce();
  });

  it('corrupt JSON in getItem degrades and returns memory fallback', () => {
    mockGetItem.mockReturnValue('{not json');

    const value = createSafeStorage().getItem('k');

    expect(isDegraded()).toBe(true);
    // 'k' was never written to memoryStore, so fallback is null
    expect(value).toBeNull();
  });

  it('listener registered after degradation fires immediately', () => {
    mockSetItem.mockImplementation(() => {
      throw new Error('disk full');
    });

    createSafeStorage().setItem('k', '"v"');
    expect(isDegraded()).toBe(true);

    const cb = vi.fn();
    subscribeDegrade(cb);

    expect(cb).toHaveBeenCalledOnce();
  });

  it('subscribeDegrade returns an unsubscribe function and callback fires at most once', () => {
    mockSetItem.mockImplementation(() => {
      throw new Error('disk full');
    });

    const listener = vi.fn();
    const unsubscribe = subscribeDegrade(listener);
    expect(typeof unsubscribe).toBe('function');

    const storage = createSafeStorage();
    storage.setItem('k', '"v"');   // degrades, listener fires
    storage.setItem('k2', '"v2"'); // _degraded already true, markDegraded early-returns

    expect(listener).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// settings slice — partialize / merge / action invariants
// ---------------------------------------------------------------------------

describe('settings slice', () => {
  let store: typeof import('../useActiveWorkoutStore').useActiveWorkoutStore;

  beforeEach(async () => {
    vi.resetModules();

    globalThis.window = {
      localStorage: {
        getItem: vi.fn().mockReturnValue(null),
        setItem: vi.fn(),
        removeItem: vi.fn(),
      },
    } as unknown as Window & typeof globalThis;

    const mod = await import('../useActiveWorkoutStore');
    store = mod.useActiveWorkoutStore;
  });

  afterEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (globalThis as any).window;
  });

  it('setUserSettings merges the patch without touching other settings fields', () => {
    store.getState().setUserSettings({ weightUnit: 'kg' });
    const s = store.getState();
    expect(s.settings.weightUnit).toBe('kg');
    expect(s.settings.restTimerDefaultSeconds).toBe(90);
  });

  it('partialize captures updated settings, merge restores them (simulated reload)', () => {
    store.getState().setUserSettings({ weightUnit: 'kg' });
    const state = store.getState();
    const opts = store.persist.getOptions() as PersistOptions<ActiveWorkoutStoreState>;
    const slice = opts.partialize!(state);
    expect((slice as { settings?: { weightUnit: string } }).settings?.weightUnit).toBe('kg');
    // Use a fresh baseline state with default settings for the current argument
    const freshCurrent = {
      hydrated: false,
      settings: { weightUnit: 'lbs', restTimerDefaultSeconds: 90 },
      meta: null,
      exercises: [],
      restTimer: {},
      sync: { online: true, flushing: false, lastFlushError: null, pendingCount: 0, persistenceMode: 'localStorage' },
      queue: [],
      quarantine: [],
      tombstones: {},
    };
    const merged = opts.merge!(slice, freshCurrent);
    expect((merged as { settings?: { weightUnit: string } }).settings?.weightUnit).toBe('kg');
    expect((merged as { settings?: { restTimerDefaultSeconds: number } }).settings?.restTimerDefaultSeconds).toBe(90);
  });

  it('merge falls back to INITIAL_SETTINGS when persisted snapshot predates the settings field', () => {
    const state = store.getState();
    const opts = store.persist.getOptions() as PersistOptions<ActiveWorkoutStoreState>;
    const slice = opts.partialize!(state);
    // Simulate an older persisted snapshot that has no settings key
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { settings: _omit, ...sliceWithoutSettings } = slice as any;
    const merged = opts.merge!(sliceWithoutSettings, state);
    expect((merged as { settings?: { weightUnit: string; restTimerDefaultSeconds: number } }).settings?.weightUnit).toBe('lbs');
    expect((merged as { settings?: { weightUnit: string; restTimerDefaultSeconds: number } }).settings?.restTimerDefaultSeconds).toBe(90);
  });

  it('discardDraft does not reset settings', () => {
    store.getState().setUserSettings({ weightUnit: 'kg' });
    store.getState().startDraft();
    store.getState().discardDraft();
    expect(store.getState().settings.weightUnit).toBe('kg');
  });

  it('clearCompletedSession does not reset settings', () => {
    store.getState().setUserSettings({ weightUnit: 'kg' });
    store.getState().startDraft();
    store.getState().endWorkout();
    store.getState().clearCompletedSession();
    expect(store.getState().settings.weightUnit).toBe('kg');
  });
});
