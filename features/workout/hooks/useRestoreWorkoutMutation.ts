'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createSupabaseBrowserClient } from '@/lib/supabase';
import { toast } from '@/components/ui/sonner';
import { newClientMutationId } from '@/lib/idempotency';
import { useStartWorkoutAction } from './useStartWorkoutAction';
import type { StartWorkoutResult } from './useStartWorkoutAction';
import { useActiveWorkoutStore } from '../store/useActiveWorkoutStore';
import { selectHasActiveDraft, selectIsCompletedLocalProtected } from '../store/selectors';
import type { ServerWorkoutSnapshot } from '../store/useActiveWorkoutStore';
import type { ActiveWorkoutExercise, ActiveSet } from '../store/types';
import type { StartIntent } from '../store/resumeCoordinator';

const CONFLICT_MSG = 'Finish or discard your current active workout before restoring this one.';
const SYNC_IN_PROGRESS_MSG =
  'Workout is still syncing. Please wait before starting another workout.';

class RestoreConflictError extends Error {
  constructor() {
    super('active-draft-exists');
    this.name = 'RestoreConflictError';
  }
}

export class SyncInProgressError extends Error {
  constructor() {
    super('sync-in-progress');
    this.name = 'SyncInProgressError';
  }
}

export class RestoreReconciliationError extends Error {
  constructor() {
    super('restore-reconciliation-failed');
    this.name = 'RestoreReconciliationError';
  }
}

function newLocalId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

interface WorkoutWithRelations {
  id: string;
  name: string | null;
  started_at: string;
  last_activity_at: string;
  plan_workout_id: string | null;
  workout_exercises: Array<{
    id: string;
    exercise_id: string;
    position: number;
    sets: Array<{
      id: string;
      reps: number;
      set_number: number;
      weight_value: number;
      weight_unit: 'lbs' | 'kg';
      logged_at: string;
    }>;
  }>;
}

/**
 * Reverts an orphaned restored workout back to expired so it remains visible
 * and restorable from History. Called when the server successfully flipped the
 * workout to in_progress but the client subsequently cannot accept the draft.
 * Throws on network error or non-ok HTTP so callers can detect compensation
 * failure and surface a distinct reconciliation error instead of a blocked
 * message that would be misleading about the actual server state.
 */
async function revertRestoredOrphan(id: string, fetchImpl: typeof fetch): Promise<void> {
  const res = await fetchImpl(`/api/workouts/${id}/restore`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clientMutationId: newClientMutationId() }),
  });
  if (!res.ok) {
    throw new Error(`Revert failed with HTTP ${res.status}`);
  }
}

/**
 * Core restore logic extracted for testability. All dependencies that differ
 * between production and tests are injected as parameters.
 */
export async function runRestoreMutation(
  id: string,
  startWorkout: (intent: StartIntent) => Promise<StartWorkoutResult>,
  fetchImpl: typeof fetch = fetch,
  invalidateRestoreTarget?: () => Promise<void>,
): Promise<void> {
  // Local active-draft pre-check: block before any server round-trip so a
  // pending local draft cannot be corrupted by the server restore flipping
  // the workout's status to in_progress first.
  if (selectHasActiveDraft(useActiveWorkoutStore.getState())) {
    throw new RestoreConflictError();
  }
  // completed_local is protected until the completion queue drains.
  if (selectIsCompletedLocalProtected(useActiveWorkoutStore.getState())) {
    throw new SyncInProgressError();
  }

  const clientMutationId = newClientMutationId();

  const res = await fetchImpl(`/api/workouts/${id}/restore`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clientMutationId }),
  });

  if (!res.ok) {
    let code: string | undefined;
    try {
      const body = (await res.json()) as { error?: { code?: string } };
      code = body.error?.code;
    } catch {
      // ignore parse errors
    }
    if (res.status === 422 && code === 'ACTIVE_DRAFT_EXISTS') {
      throw new RestoreConflictError();
    }
    // 404 NOT_FOUND, 422 NOT_EXPIRED, or unexpected errors
    throw new Error(code ?? `HTTP ${res.status}`);
  }

  // Post-restore re-check: completed_local may have appeared while the server
  // round-trip was in flight. The server already flipped the workout to
  // in_progress, so we must revert the orphan before blocking the client.
  if (selectIsCompletedLocalProtected(useActiveWorkoutStore.getState())) {
    try {
      await revertRestoredOrphan(id, fetchImpl);
    } catch {
      await invalidateRestoreTarget?.();
      throw new RestoreReconciliationError();
    }
    throw new SyncInProgressError();
  }

  // Fetch the now-restored workout's full snapshot to hydrate the store.
  const supabase = createSupabaseBrowserClient();
  const { data: rawRow, error: fetchErr } = await supabase
    .from('workouts')
    .select('*, workout_exercises(*, sets(*))')
    .eq('id', id)
    .maybeSingle();

  if (fetchErr) throw fetchErr as unknown as Error;
  if (!rawRow) throw new Error('Restored workout not found');

  const row = rawRow as unknown as WorkoutWithRelations;

  const exercises: ActiveWorkoutExercise[] = (row.workout_exercises ?? []).map((we) => {
    const exerciseLocalId = newLocalId();
    const sets: ActiveSet[] = we.sets.map((s) => ({
      localId: newLocalId(),
      serverId: s.id,
      workoutExerciseLocalId: exerciseLocalId,
      setNumber: s.set_number,
      reps: s.reps,
      weightValue: s.weight_value,
      weightUnit: s.weight_unit,
      loggedAt: s.logged_at,
      pending: false,
    }));
    return {
      localId: exerciseLocalId,
      serverId: we.id,
      exerciseId: we.exercise_id,
      position: we.position,
      sets,
    };
  });

  const snapshot: ServerWorkoutSnapshot = {
    meta: {
      workoutId: row.id,
      localId: newLocalId(),
      name: row.name ?? '',
      status: 'in_progress',
      startedAt: row.started_at,
      lastActivityAt: row.last_activity_at,
      planWorkoutId: row.plan_workout_id,
      originPlanWorkoutId: row.plan_workout_id,
    },
    exercises,
  };

  const result = await startWorkout({ source: 'history-restore', payload: { snapshot } });
  if (result?.blocked) {
    // Server restore already committed — revert the orphaned in_progress workout
    // before surfacing the block so no hidden draft is left behind. Only surface
    // the blocked error once revert is confirmed; a revert failure means the
    // server state is unknown, so surface a distinct reconciliation error instead.
    const blockedError =
      result.reason === 'sync-in-progress' ? new SyncInProgressError() : new RestoreConflictError();
    try {
      await revertRestoredOrphan(id, fetchImpl);
    } catch {
      await invalidateRestoreTarget?.();
      throw new RestoreReconciliationError();
    }
    throw blockedError;
  }
}

export function useRestoreWorkoutMutation() {
  const queryClient = useQueryClient();
  const startWorkout = useStartWorkoutAction();

  return useMutation<void, Error, { id: string }>({
    mutationFn: ({ id }) =>
      runRestoreMutation(id, startWorkout, fetch, () =>
        queryClient.invalidateQueries({ queryKey: ['workout-history'] }),
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['workout-history'] });
    },
    onError: (err) => {
      if (err instanceof RestoreConflictError) {
        toast.error(CONFLICT_MSG);
      } else if (err instanceof SyncInProgressError) {
        toast.error(SYNC_IN_PROGRESS_MSG);
      } else if (err instanceof RestoreReconciliationError) {
        toast.error('Could not complete the restore. Please refresh and try again.');
      } else {
        toast.error('Could not restore this workout.');
      }
    },
  });
}
