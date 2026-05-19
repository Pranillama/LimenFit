import { describe, it, expect, vi, beforeEach } from 'vitest';

// Hoist all vi.mock calls before any imports so module-level side effects
// of React/browser-only modules do not run in the node test environment.

vi.mock('@tanstack/react-query', () => ({
  useMutation: vi.fn(() => ({})),
  useQueryClient: vi.fn(() => ({})),
}));

vi.mock('@/components/ui/sonner', () => ({
  toast: { error: vi.fn() },
}));

vi.mock('@/lib/supabase', () => ({
  createSupabaseBrowserClient: vi.fn(),
}));

vi.mock('../useStartWorkoutAction', () => ({
  useStartWorkoutAction: vi.fn(),
}));

vi.mock('../../store/useActiveWorkoutStore', () => ({
  useActiveWorkoutStore: {
    getState: vi.fn(),
  },
}));

import { createSupabaseBrowserClient } from '@/lib/supabase';
import { useActiveWorkoutStore } from '../../store/useActiveWorkoutStore';

const mockGetState = vi.mocked(useActiveWorkoutStore.getState);
const mockCreateSupabase = vi.mocked(createSupabaseBrowserClient);

// Dynamic import ensures all vi.mock factories above are applied first.
const { runRestoreMutation } = await import('../useRestoreWorkoutMutation');

// Minimal state helpers
function stateNoDraft() {
  return { meta: null } as ReturnType<typeof useActiveWorkoutStore.getState>;
}

function stateWithDraft() {
  return { meta: { localId: 'draft-1', status: 'in_progress' } } as ReturnType<
    typeof useActiveWorkoutStore.getState
  >;
}

function stateCompletedLocal() {
  return {
    meta: { localId: 'workout-1', status: 'completed_local', workoutId: 'server-1' },
  } as ReturnType<typeof useActiveWorkoutStore.getState>;
}

// Chainable Supabase mock for the snapshot fetch (returns the given row).
function makeSnapshotSupabase(row: Record<string, unknown> | null) {
  return {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: () => Promise.resolve({ data: row, error: null }),
        }),
      }),
    }),
  } as unknown as ReturnType<typeof createSupabaseBrowserClient>;
}

const fakeSnapshotRow = {
  id: 'workout-123',
  name: 'Old Lift',
  started_at: '2026-01-01T10:00:00Z',
  last_activity_at: '2026-01-01T10:00:00Z',
  plan_workout_id: null,
  workout_exercises: [],
};

// Returns a fetchSpy that serves POST restore (ok) and then DELETE revert (ok).
function makeRestoreAndCleanupFetch() {
  return vi
    .fn()
    .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) }) // POST restore
    .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) }); // DELETE revert
}

describe('runRestoreMutation — pre-flight checks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('throws RestoreConflictError and does not call fetch when an active local draft exists', async () => {
    mockGetState.mockReturnValue(stateWithDraft());
    const fetchSpy = vi.fn();
    const startWorkout = vi.fn();

    await expect(runRestoreMutation('workout-123', startWorkout, fetchSpy)).rejects.toMatchObject({
      name: 'RestoreConflictError',
      message: 'active-draft-exists',
    });

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('throws SyncInProgressError and does not call fetch when store is in completed_local', async () => {
    mockGetState.mockReturnValue(stateCompletedLocal());
    const fetchSpy = vi.fn();
    const startWorkout = vi.fn();

    await expect(runRestoreMutation('workout-123', startWorkout, fetchSpy)).rejects.toMatchObject({
      name: 'SyncInProgressError',
      message: 'sync-in-progress',
    });

    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe('runRestoreMutation — post-restore race: completed_local appears mid-flight', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('cleans up the orphaned restored workout and throws SyncInProgressError when completed_local appears after server restore', async () => {
    // Pre-checks pass (calls 1 and 2), then completed_local detected on post-restore re-check (call 3+).
    mockGetState
      .mockReturnValueOnce(stateNoDraft()) // selectHasActiveDraft pre-check
      .mockReturnValueOnce(stateNoDraft()) // selectIsCompletedLocalProtected pre-check
      .mockReturnValue(stateCompletedLocal()); // post-restore re-check

    const fetchSpy = makeRestoreAndCleanupFetch();
    const startWorkout = vi.fn();

    await expect(runRestoreMutation('workout-123', startWorkout, fetchSpy)).rejects.toMatchObject({
      name: 'SyncInProgressError',
      message: 'sync-in-progress',
    });

    // POST restore + DELETE revert both fired.
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(fetchSpy).toHaveBeenNthCalledWith(
      1,
      '/api/workouts/workout-123/restore',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(fetchSpy).toHaveBeenNthCalledWith(
      2,
      '/api/workouts/workout-123/restore',
      expect.objectContaining({ method: 'DELETE' }),
    );

    // startWorkout was never reached.
    expect(startWorkout).not.toHaveBeenCalled();
  });

  it('does not fire the DELETE cleanup when completed_local is detected in the pre-check (before server round-trip)', async () => {
    // Both pre-checks see completed_local.
    mockGetState.mockReturnValue(stateCompletedLocal());
    const fetchSpy = vi.fn();
    const startWorkout = vi.fn();

    await expect(runRestoreMutation('workout-123', startWorkout, fetchSpy)).rejects.toMatchObject({
      name: 'SyncInProgressError',
    });

    // No fetch calls at all — blocked before the server round-trip.
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe('runRestoreMutation — startWorkout blocked after successful restore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('reverts orphan via DELETE /restore and throws SyncInProgressError when startWorkout returns sync-in-progress', async () => {
    mockGetState.mockReturnValue(stateNoDraft());
    mockCreateSupabase.mockReturnValue(makeSnapshotSupabase(fakeSnapshotRow));

    const fetchSpy = makeRestoreAndCleanupFetch();
    const startWorkout = vi.fn().mockResolvedValue({ blocked: true, reason: 'sync-in-progress' });

    await expect(runRestoreMutation('workout-123', startWorkout, fetchSpy)).rejects.toMatchObject({
      name: 'SyncInProgressError',
      message: 'sync-in-progress',
    });

    // POST restore + DELETE revert — revert must target the restore endpoint, not the workout delete endpoint.
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(fetchSpy).toHaveBeenNthCalledWith(
      2,
      '/api/workouts/workout-123/restore',
      expect.objectContaining({ method: 'DELETE' }),
    );
  });

  it('reverts orphan via DELETE /restore and throws RestoreConflictError when startWorkout returns active-draft-exists', async () => {
    mockGetState.mockReturnValue(stateNoDraft());
    mockCreateSupabase.mockReturnValue(makeSnapshotSupabase(fakeSnapshotRow));

    const fetchSpy = makeRestoreAndCleanupFetch();
    const startWorkout = vi
      .fn()
      .mockResolvedValue({ blocked: true, reason: 'active-draft-exists' });

    await expect(runRestoreMutation('workout-123', startWorkout, fetchSpy)).rejects.toMatchObject({
      name: 'RestoreConflictError',
      message: 'active-draft-exists',
    });

    // POST restore + DELETE revert.
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(fetchSpy).toHaveBeenNthCalledWith(
      2,
      '/api/workouts/workout-123/restore',
      expect.objectContaining({ method: 'DELETE' }),
    );
  });

  it('does not call invalidateRestoreTarget when revert succeeds after startWorkout is blocked', async () => {
    mockGetState.mockReturnValue(stateNoDraft());
    mockCreateSupabase.mockReturnValue(makeSnapshotSupabase(fakeSnapshotRow));

    const fetchSpy = makeRestoreAndCleanupFetch();
    const startWorkout = vi.fn().mockResolvedValue({ blocked: true, reason: 'sync-in-progress' });
    const invalidateRestoreTarget = vi.fn();

    await expect(
      runRestoreMutation('workout-123', startWorkout, fetchSpy, invalidateRestoreTarget),
    ).rejects.toMatchObject({ name: 'SyncInProgressError' });

    expect(invalidateRestoreTarget).not.toHaveBeenCalled();
  });

  it('throws RestoreReconciliationError and calls invalidateRestoreTarget when revert network call fails after startWorkout blocked', async () => {
    mockGetState.mockReturnValue(stateNoDraft());
    mockCreateSupabase.mockReturnValue(makeSnapshotSupabase(fakeSnapshotRow));

    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) }) // POST restore
      .mockRejectedValueOnce(new Error('network error')); // DELETE revert network failure
    const startWorkout = vi.fn().mockResolvedValue({ blocked: true, reason: 'sync-in-progress' });
    const invalidateRestoreTarget = vi.fn().mockResolvedValue(undefined);

    await expect(
      runRestoreMutation('workout-123', startWorkout, fetchSpy, invalidateRestoreTarget),
    ).rejects.toMatchObject({ name: 'RestoreReconciliationError' });

    expect(invalidateRestoreTarget).toHaveBeenCalledOnce();
  });

  it('throws RestoreReconciliationError and calls invalidateRestoreTarget when revert returns non-ok HTTP after startWorkout blocked', async () => {
    mockGetState.mockReturnValue(stateNoDraft());
    mockCreateSupabase.mockReturnValue(makeSnapshotSupabase(fakeSnapshotRow));

    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) }) // POST restore
      .mockResolvedValueOnce({ ok: false, status: 500 }); // DELETE revert HTTP error
    const startWorkout = vi.fn().mockResolvedValue({ blocked: true, reason: 'sync-in-progress' });
    const invalidateRestoreTarget = vi.fn().mockResolvedValue(undefined);

    await expect(
      runRestoreMutation('workout-123', startWorkout, fetchSpy, invalidateRestoreTarget),
    ).rejects.toMatchObject({ name: 'RestoreReconciliationError' });

    expect(invalidateRestoreTarget).toHaveBeenCalledOnce();
  });

  it('never surfaces SyncInProgressError or RestoreConflictError when revert fails', async () => {
    mockGetState.mockReturnValue(stateNoDraft());
    mockCreateSupabase.mockReturnValue(makeSnapshotSupabase(fakeSnapshotRow));

    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) })
      .mockRejectedValueOnce(new Error('network'));
    const startWorkout = vi.fn().mockResolvedValue({ blocked: true, reason: 'sync-in-progress' });

    const err = await runRestoreMutation('workout-123', startWorkout, fetchSpy, vi.fn()).catch(
      (e) => e,
    );

    expect(err.name).not.toBe('SyncInProgressError');
    expect(err.name).not.toBe('RestoreConflictError');
  });
});

describe('runRestoreMutation — compensation failure after completed_local race', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('throws RestoreReconciliationError and calls invalidateRestoreTarget when revert fails after completed_local race', async () => {
    mockGetState
      .mockReturnValueOnce(stateNoDraft()) // selectHasActiveDraft pre-check
      .mockReturnValueOnce(stateNoDraft()) // selectIsCompletedLocalProtected pre-check
      .mockReturnValue(stateCompletedLocal()); // post-restore re-check detects race

    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) }) // POST restore
      .mockRejectedValueOnce(new Error('network error')); // DELETE revert fails
    const startWorkout = vi.fn();
    const invalidateRestoreTarget = vi.fn().mockResolvedValue(undefined);

    await expect(
      runRestoreMutation('workout-123', startWorkout, fetchSpy, invalidateRestoreTarget),
    ).rejects.toMatchObject({ name: 'RestoreReconciliationError' });

    expect(invalidateRestoreTarget).toHaveBeenCalledOnce();
    expect(startWorkout).not.toHaveBeenCalled();
  });
});
