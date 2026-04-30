import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

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
