import type { OneRepMaxPoint, PersonalRecord } from './types';

/**
 * Walks each exercise's session series chronologically and flags sessions that
 * set a personal record on either e1RM or absolute weight×reps.
 *
 * PR rule: e1rm exceeds prior best, OR top-set weight exceeds prior best weight
 * with reps that are not lower than the prior best reps. A pure tie that does
 * not improve e1rm is not a PR.
 */
export function derivePersonalRecords(oneRepMaxSeries: OneRepMaxPoint[]): PersonalRecord[] {
  const grouped = new Map<string, OneRepMaxPoint[]>();
  for (const point of oneRepMaxSeries) {
    if (!grouped.has(point.exerciseId)) grouped.set(point.exerciseId, []);
    grouped.get(point.exerciseId)!.push(point);
  }

  const records: PersonalRecord[] = [];

  for (const series of grouped.values()) {
    const sorted = [...series].sort((a, b) => a.workoutDate.localeCompare(b.workoutDate));

    let bestE1rm: number | null = null;
    let bestTopSetWeight = -Infinity;
    let bestTopSetReps = -Infinity;

    for (const point of sorted) {
      const priorBestE1rm = bestE1rm;
      const beatsE1rm = priorBestE1rm === null || point.e1rm > priorBestE1rm;
      const beatsAbsolute =
        point.topSetWeight > bestTopSetWeight && point.topSetReps >= bestTopSetReps;

      const isPR = beatsE1rm || (priorBestE1rm !== null && beatsAbsolute);

      if (isPR) {
        records.push({
          exerciseId: point.exerciseId,
          exerciseName: point.exerciseName,
          workoutDate: point.workoutDate,
          topSetWeight: point.topSetWeight,
          topSetReps: point.topSetReps,
          e1rm: point.e1rm,
          weightUnit: point.weightUnit,
          priorBestE1rm,
        });
      }

      if (bestE1rm === null || point.e1rm > bestE1rm) bestE1rm = point.e1rm;
      if (point.topSetWeight > bestTopSetWeight) {
        bestTopSetWeight = point.topSetWeight;
        bestTopSetReps = point.topSetReps;
      }
    }
  }

  return records;
}
