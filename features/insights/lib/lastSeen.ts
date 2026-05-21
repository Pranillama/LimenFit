import type { ExerciseHistorySample } from './types';

/**
 * Returns the latest `workoutDate` string per muscle group key.
 * Keys are the raw muscle-group identifiers (e.g. "chest", "full_body").
 */
export function deriveLastSeenByGroup(samples: ExerciseHistorySample[]): Record<string, string> {
  const latest: Record<string, string> = {};
  for (const sample of samples) {
    const key = sample.muscleGroup;
    const current = latest[key];
    if (!current || sample.workoutDate > current) {
      latest[key] = sample.workoutDate;
    }
  }
  return latest;
}
