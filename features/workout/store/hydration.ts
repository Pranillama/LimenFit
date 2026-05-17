import { createSupabaseBrowserClient } from '@/lib/supabase';
import { selectHasActiveDraft } from './selectors';
import { useActiveWorkoutStore } from './useActiveWorkoutStore';
import type { ServerWorkoutSnapshot } from './useActiveWorkoutStore';
import type { ActiveWorkoutExercise, ActiveSet } from './types';

let _client: ReturnType<typeof createSupabaseBrowserClient> | null = null;

function getClient() {
  if (!_client) _client = createSupabaseBrowserClient();
  return _client;
}

// Returns true only for errors that indicate a missing or invalid session
// (PostgREST JWT errors). Every other error — network, server 5xx, etc. —
// is retriable and must not be swallowed.
function isAuthRelatedError(err: Record<string, unknown>): boolean {
  if (typeof err.code === 'string') {
    // PGRST301 = JWT expired/invalid; PGRST302 = role not set
    if (err.code === 'PGRST301' || err.code === 'PGRST302') return true;
  }
  const msg = typeof err.message === 'string' ? err.message.toLowerCase() : '';
  return msg.includes('jwt') || msg.includes('session') || msg.includes('not authenticated');
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

/**
 * Hydrates the active workout store from the server when no local draft exists.
 *
 * Priority: local draft wins — if the store already has an in-progress draft after
 * local persistence loads, the server query is skipped entirely (prefer local draft
 * per Flow 3 in spec:Core Flows — LimenFit Phase 1). The draft check is also repeated
 * after the Supabase response arrives to guard against a draft started while the
 * request was in flight.
 *
 * Auth errors (missing/invalid session) are swallowed silently; all other errors
 * (network, server 5xx) are thrown so callers can retry rather than silently treating
 * a failure as "no active workout on server."
 */
export async function hydrateActiveWorkout(store: typeof useActiveWorkoutStore): Promise<void> {
  // Step 1: wait for local persistence to finish hydrating
  if (!store.persist.hasHydrated()) {
    await new Promise<void>((resolve) => {
      const unsub = store.persist.onFinishHydration(() => {
        unsub();
        resolve();
      });
    });
  }

  // Step 2: local draft wins
  if (selectHasActiveDraft(store.getState())) return;

  // Step 3: query the server for an in-progress workout — RLS restricts to current user
  const supabase = getClient();

  // The Supabase TypeScript generics don't resolve nested relation shapes from
  // select strings at the type level, so we cast the response to an explicit
  // interface once at the query boundary and let the transform below be fully typed.
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
      workout_id: string;
      sets: Array<{
        id: string;
        reps: number;
        set_number: number;
        weight_value: number;
        weight_unit: 'lbs' | 'kg';
        logged_at: string;
        workout_exercise_id: string;
      }>;
    }>;
  }

  const { data: rawRow, error } = await supabase
    .from('workouts')
    .select('*, workout_exercises(*, sets(*))')
    .eq('status', 'in_progress')
    .maybeSingle();

  if (error) {
    // Only swallow auth-related errors (missing/invalid session). Transient
    // network or server errors are thrown so the caller can retry.
    if (isAuthRelatedError(error as unknown as Record<string, unknown>)) return;
    throw error;
  }
  if (!rawRow) return;

  const row = rawRow as unknown as WorkoutWithRelations;

  // Step 4: transform server row → store shape with all serverId fields populated
  // and zero queued mutations (mutations are generated on the next user action).
  const workoutExercises = row.workout_exercises ?? [];

  const exercises: ActiveWorkoutExercise[] = workoutExercises.map((we) => {
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
      // origin_plan_workout_id is not persisted in the DB schema; fall back to plan_workout_id
      originPlanWorkoutId: row.plan_workout_id,
    },
    exercises,
  };

  // Re-check: a local draft may have been started while the Supabase request was in
  // flight. Local draft always wins — do not overwrite it with the server snapshot.
  if (selectHasActiveDraft(store.getState())) return;

  store.getState().hydrateFromServer(snapshot);
}
