import { newClientMutationId } from '@/lib/idempotency';
import type {
  WorkoutCreateMutation,
  WorkoutPatchMutation,
  WorkoutDiscardMutation,
  WorkoutRestoreMutation,
  WorkoutExerciseAddMutation,
  WorkoutExerciseRemoveMutation,
  WorkoutExerciseReorderMutation,
  SetLogMutation,
  SetEditMutation,
  SetDeleteMutation,
} from './types';

function baseMeta(dependsOnLocalIds: string[]) {
  return {
    clientMutationId: newClientMutationId(),
    enqueuedAt: new Date().toISOString(),
    attempts: 0,
    dependsOnLocalIds,
  };
}

/**
 * Builds a workout.create mutation.
 * Target: POST /api/workouts
 */
export function buildWorkoutCreateMutation(
  payload: WorkoutCreateMutation['payload'],
  extraDependencies: string[] = [],
): WorkoutCreateMutation {
  return { kind: 'workout.create', ...baseMeta(extraDependencies), payload };
}

/**
 * Builds a workout.patch mutation.
 * Target: PATCH /api/workouts/[id]
 */
export function buildWorkoutPatchMutation(
  payload: WorkoutPatchMutation['payload'],
  extraDependencies: string[] = [],
): WorkoutPatchMutation {
  return { kind: 'workout.patch', ...baseMeta([payload.localId, ...extraDependencies]), payload };
}

/**
 * Builds a workout.discard mutation.
 * Target: DELETE /api/workouts/[id]
 */
export function buildWorkoutDiscardMutation(
  payload: WorkoutDiscardMutation['payload'],
  extraDependencies: string[] = [],
): WorkoutDiscardMutation {
  return { kind: 'workout.discard', ...baseMeta([payload.localId, ...extraDependencies]), payload };
}

/**
 * Builds a workout.restore mutation.
 * Target: POST /api/workouts/[id]/restore
 */
export function buildWorkoutRestoreMutation(
  payload: WorkoutRestoreMutation['payload'],
  extraDependencies: string[] = [],
): WorkoutRestoreMutation {
  return { kind: 'workout.restore', ...baseMeta([payload.localId, ...extraDependencies]), payload };
}

/**
 * Builds a workoutExercise.add mutation.
 * Target: POST /api/workout-exercises
 */
export function buildWorkoutExerciseAddMutation(
  payload: WorkoutExerciseAddMutation['payload'],
  extraDependencies: string[] = [],
): WorkoutExerciseAddMutation {
  return {
    kind: 'workoutExercise.add',
    ...baseMeta([payload.workoutLocalId, ...extraDependencies]),
    payload,
  };
}

/**
 * Builds a workoutExercise.remove mutation.
 * Target: DELETE /api/workout-exercises/[id]
 */
export function buildWorkoutExerciseRemoveMutation(
  payload: WorkoutExerciseRemoveMutation['payload'],
  extraDependencies: string[] = [],
): WorkoutExerciseRemoveMutation {
  return {
    kind: 'workoutExercise.remove',
    ...baseMeta([payload.localId, ...extraDependencies]),
    payload,
  };
}

/**
 * Builds a workoutExercise.reorder mutation for a single exercise resource.
 * Target: PATCH /api/workout-exercises/[id]
 * If reordering a full list, enqueue one descriptor per moved exercise.
 */
export function buildWorkoutExerciseReorderMutation(
  payload: WorkoutExerciseReorderMutation['payload'],
  extraDependencies: string[] = [],
): WorkoutExerciseReorderMutation {
  return {
    kind: 'workoutExercise.reorder',
    ...baseMeta([payload.localId, ...extraDependencies]),
    payload,
  };
}

/**
 * Builds a set.log mutation.
 * Target: POST /api/sets
 */
export function buildSetLogMutation(
  payload: SetLogMutation['payload'],
  extraDependencies: string[] = [],
): SetLogMutation {
  return {
    kind: 'set.log',
    ...baseMeta([payload.workoutExerciseLocalId, ...extraDependencies]),
    payload,
  };
}

/**
 * Builds a set.edit mutation.
 * Target: PATCH /api/sets/[id]
 */
export function buildSetEditMutation(
  payload: SetEditMutation['payload'],
  extraDependencies: string[] = [],
): SetEditMutation {
  return { kind: 'set.edit', ...baseMeta([payload.localId, ...extraDependencies]), payload };
}

/**
 * Builds a set.delete mutation.
 * Target: DELETE /api/sets/[id]
 */
export function buildSetDeleteMutation(
  payload: SetDeleteMutation['payload'],
  extraDependencies: string[] = [],
): SetDeleteMutation {
  return { kind: 'set.delete', ...baseMeta([payload.localId, ...extraDependencies]), payload };
}
