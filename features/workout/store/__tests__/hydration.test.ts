import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ActiveWorkoutState } from '../types';

// The mock is hoisted before any imports, so createSupabaseBrowserClient returns
// a proxy that delegates maybeSingle() to the test-controlled variable below.
let mockMaybeSingle: () => Promise<{ data: unknown; error: unknown }> = () =>
  Promise.resolve({ data: null, error: null });

vi.mock('@/lib/supabase', () => ({
  createSupabaseBrowserClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: () => mockMaybeSingle(),
        }),
      }),
    }),
  }),
}));

// Dynamic import so the vi.mock above takes effect first.
const { hydrateActiveWorkout } = await import('../hydration');

function makeStore(overrides: {
  hasDraft?: () => boolean;
  completedLocal?: () => boolean;
  hydrateFromServer?: ReturnType<typeof vi.fn>;
}) {
  const hydrateFromServer = overrides.hydrateFromServer ?? vi.fn();
  const hasDraft = overrides.hasDraft ?? (() => false);
  const completedLocal = overrides.completedLocal ?? (() => false);
  return {
    persist: {
      hasHydrated: () => true,
      onFinishHydration: vi.fn(),
    },
    getState: () =>
      ({
        meta: hasDraft()
          ? { localId: 'local-draft', status: 'in_progress' as const }
          : completedLocal()
            ? { localId: 'local-draft', status: 'completed_local' as const }
            : null,
        exercises: [],
        queue: [],
        quarantine: [],
        tombstones: {},
        restTimer: {},
        sync: {
          online: true,
          flushing: false,
          lastFlushError: null,
          pendingCount: 0,
          persistenceMode: 'localStorage' as const,
        },
        hydrateFromServer,
      }) as unknown as ActiveWorkoutState & { hydrateFromServer: typeof hydrateFromServer },
  } as unknown as Parameters<typeof hydrateActiveWorkout>[0];
}

const serverRow = {
  id: 'server-w1',
  name: 'Morning Lift',
  started_at: '2026-01-01T10:00:00Z',
  last_activity_at: '2026-01-01T10:00:00Z',
  plan_workout_id: null,
  workout_exercises: [],
};

describe('hydrateActiveWorkout', () => {
  beforeEach(() => {
    mockMaybeSingle = () => Promise.resolve({ data: null, error: null });
  });

  it('applies the server snapshot when no local draft exists', async () => {
    mockMaybeSingle = () => Promise.resolve({ data: serverRow, error: null });
    const hydrateFromServer = vi.fn();
    const store = makeStore({ hydrateFromServer });

    await hydrateActiveWorkout(store);

    expect(hydrateFromServer).toHaveBeenCalledOnce();
  });

  it('does not apply server snapshot when a local draft appears while the query is in flight', async () => {
    let resolveQuery!: (value: { data: unknown; error: null }) => void;
    mockMaybeSingle = () =>
      new Promise<{ data: unknown; error: null }>((r) => {
        resolveQuery = r;
      });

    const hydrateFromServer = vi.fn();
    let hasDraft = false;
    const store = makeStore({ hasDraft: () => hasDraft, hydrateFromServer });

    const hydratePromise = hydrateActiveWorkout(store);

    // Simulate a draft being started while the Supabase request is in flight.
    hasDraft = true;

    resolveQuery({ data: serverRow, error: null });
    await hydratePromise;

    expect(hydrateFromServer).not.toHaveBeenCalled();
  });

  it('skips silently when the server returns no active workout', async () => {
    mockMaybeSingle = () => Promise.resolve({ data: null, error: null });
    const hydrateFromServer = vi.fn();
    const store = makeStore({ hydrateFromServer });

    await hydrateActiveWorkout(store);

    expect(hydrateFromServer).not.toHaveBeenCalled();
  });

  it('throws for non-auth errors so the caller can retry', async () => {
    mockMaybeSingle = () =>
      Promise.resolve({ data: null, error: { message: 'connection refused', code: '08006' } });
    const store = makeStore({});

    await expect(hydrateActiveWorkout(store)).rejects.toBeTruthy();
  });

  it('does not apply server snapshot when store is in completed_local (protected state)', async () => {
    mockMaybeSingle = () => Promise.resolve({ data: serverRow, error: null });
    const hydrateFromServer = vi.fn();
    const store = makeStore({ completedLocal: () => true, hydrateFromServer });

    await hydrateActiveWorkout(store);

    expect(hydrateFromServer).not.toHaveBeenCalled();
  });

  it('does not apply server snapshot when completed_local appears while query is in flight', async () => {
    let resolveQuery!: (value: { data: unknown; error: null }) => void;
    mockMaybeSingle = () =>
      new Promise<{ data: unknown; error: null }>((r) => {
        resolveQuery = r;
      });

    const hydrateFromServer = vi.fn();
    let isCompletedLocal = false;
    const store = makeStore({ completedLocal: () => isCompletedLocal, hydrateFromServer });

    const hydratePromise = hydrateActiveWorkout(store);

    isCompletedLocal = true;
    resolveQuery({ data: serverRow, error: null });
    await hydratePromise;

    expect(hydrateFromServer).not.toHaveBeenCalled();
  });

  it('swallows PGRST301 JWT errors silently', async () => {
    mockMaybeSingle = () =>
      Promise.resolve({ data: null, error: { message: 'JWT expired', code: 'PGRST301' } });
    const hydrateFromServer = vi.fn();
    const store = makeStore({ hydrateFromServer });

    await expect(hydrateActiveWorkout(store)).resolves.toBeUndefined();
    expect(hydrateFromServer).not.toHaveBeenCalled();
  });
});
