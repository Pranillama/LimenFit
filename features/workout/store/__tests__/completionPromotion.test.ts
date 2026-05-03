import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/components/ui/sonner', () => ({ toast: { warning: vi.fn() } }));

import { useActiveWorkoutStore } from '../useActiveWorkoutStore';
import { buildWorkoutPatchMutation } from '../mutationDescriptors';
import { selectShouldAutoClear } from '../selectors';

const baseSync = {
  online: true,
  flushing: false,
  lastFlushError: null,
  pendingCount: 0,
  persistenceMode: 'localStorage' as const,
};

beforeEach(() => {
  useActiveWorkoutStore.setState({
    meta: null,
    exercises: [],
    restTimer: {},
    sync: baseSync,
    queue: [],
    quarantine: [],
    tombstones: {},
  });
});

describe('completion promotion via dropMutation', () => {
  it('promotes completed_local → completed_synced when the completed patch drains the queue', () => {
    // Start a workout and end it — queue will contain workout.create + workout.patch(completed)
    useActiveWorkoutStore.getState().startDraft();
    useActiveWorkoutStore.getState().endWorkout({ name: 'Test Workout' });

    const stateAfterEnd = useActiveWorkoutStore.getState();
    expect(stateAfterEnd.meta?.status).toBe('completed_local');
    expect(selectShouldAutoClear(stateAfterEnd)).toBe(false);

    // Simulate successful queue draining: drop mutations in order as the flush engine would
    const queueSnapshot = [...stateAfterEnd.queue];
    for (const mutation of queueSnapshot) {
      useActiveWorkoutStore.getState().dropMutation(mutation.clientMutationId);
    }

    // The completed workout patch was the last mutation drained — status must promote
    expect(useActiveWorkoutStore.getState().meta?.status).toBe('completed_synced');
    expect(selectShouldAutoClear(useActiveWorkoutStore.getState())).toBe(true);
  });

  it('does NOT promote when non-completion mutations remain in the queue after the completed patch is dropped', () => {
    const completedPatch = buildWorkoutPatchMutation({
      localId: 'local-w1',
      status: 'completed',
    });
    const trailingPatch = buildWorkoutPatchMutation({ localId: 'local-w1', name: 'Updated' });

    useActiveWorkoutStore.setState({
      meta: {
        workoutId: 'server-w1',
        localId: 'local-w1',
        name: 'Regression Workout',
        status: 'completed_local',
        startedAt: '2026-05-01T10:00:00Z',
        lastActivityAt: '2026-05-01T11:00:00Z',
        planWorkoutId: null,
        originPlanWorkoutId: null,
      },
      queue: [completedPatch, trailingPatch],
      sync: { ...baseSync, pendingCount: 2 },
    });

    useActiveWorkoutStore.getState().dropMutation(completedPatch.clientMutationId);

    expect(useActiveWorkoutStore.getState().meta?.status).toBe('completed_local');
    expect(selectShouldAutoClear(useActiveWorkoutStore.getState())).toBe(false);
  });

  it('does NOT promote when the dropped mutation is not the completed workout patch', () => {
    const namePatch = buildWorkoutPatchMutation({ localId: 'local-w1', name: 'Morning Lift' });

    useActiveWorkoutStore.setState({
      meta: {
        workoutId: 'server-w1',
        localId: 'local-w1',
        name: 'Regression Workout',
        status: 'completed_local',
        startedAt: '2026-05-01T10:00:00Z',
        lastActivityAt: '2026-05-01T11:00:00Z',
        planWorkoutId: null,
        originPlanWorkoutId: null,
      },
      queue: [namePatch],
      sync: { ...baseSync, pendingCount: 1 },
    });

    useActiveWorkoutStore.getState().dropMutation(namePatch.clientMutationId);

    expect(useActiveWorkoutStore.getState().meta?.status).toBe('completed_local');
    expect(selectShouldAutoClear(useActiveWorkoutStore.getState())).toBe(false);
  });
});
