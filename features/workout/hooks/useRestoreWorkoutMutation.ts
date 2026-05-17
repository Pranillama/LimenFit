'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createSupabaseBrowserClient } from '@/lib/supabase';
import { toast } from '@/components/ui/sonner';
import { newClientMutationId } from '@/lib/idempotency';
import { useStartWorkoutAction } from './useStartWorkoutAction';
import type { StartWorkoutResult } from './useStartWorkoutAction';
import { useActiveWorkoutStore } from '../store/useActiveWorkoutStore';
import { selectHasActiveDraft } from '../store/selectors';
import type { ServerWorkoutSnapshot } from '../store/useActiveWorkoutStore';
import type { ActiveWorkoutExercise, ActiveSet } from '../store/types';
import type { StartIntent } from '../store/resumeCoordinator';

const CONFLICT_MSG = 'Finish or discard your current active workout before restoring this one.';

class RestoreConflictError extends Error {
  constructor() {
    super('active-draft-exists');
    this.name = 'RestoreConflictError';
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
 * Core restore logic extracted for testability. All dependencies that differ
 * between production and tests are injected as parameters.
 */
export async function runRestoreMutation(
  id: string,
  startWorkout: (intent: StartIntent) => Promise<StartWorkoutResult>,
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  // Local active-draft pre-check: block before any server round-trip so a
  // pending local draft cannot be corrupted by the server restore flipping
  // the workout's status to in_progress first.
  if (selectHasActiveDraft(useActiveWorkoutStore.getState())) {
    throw new RestoreConflictError();
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
    // Local draft appeared between the server pre-check and snapshot fetch.
    throw new RestoreConflictError();
  }
}

export function useRestoreWorkoutMutation() {
  const queryClient = useQueryClient();
  const startWorkout = useStartWorkoutAction();

  return useMutation<void, Error, { id: string }>({
    mutationFn: ({ id }) => runRestoreMutation(id, startWorkout),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['workout-history'] });
    },
    onError: (err) => {
      if (err instanceof RestoreConflictError) {
        toast.error(CONFLICT_MSG);
      } else {
        toast.error('Could not restore this workout.');
      }
    },
  });
}
