import type { StartIntent } from '../store/resumeCoordinator';

type ExerciseItem = { exercise_id: string };

/**
 * Builds the StartIntent for repeating a past workout.
 * Deduplicates exercise IDs while preserving first-occurrence order so the new
 * draft's exercise sequence mirrors the original.
 */
export function buildRepeatIntent(exercises: ExerciseItem[]): StartIntent {
  const exerciseIds = Array.from(new Set(exercises.map((ex) => ex.exercise_id)));
  return {
    source: 'history',
    payload: { exercises: exerciseIds.map((id) => ({ exerciseId: id })) },
  };
}
