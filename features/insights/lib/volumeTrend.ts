import { getMondayIso, toIsoDateString } from './weekHelpers';
import type { ExerciseHistorySample, VolumeTrendPoint } from './types';

export interface VolumeTrendOptions {
  groupBy: 'muscleGroup' | 'exerciseId';
  /** Maximum number of most-recent ISO weeks to include in the output. */
  weeks: number;
}

/**
 * Computes total training volume (Σ weight × reps) bucketed by ISO week
 * (Monday-to-Monday, local time) for each group key.
 *
 * Each point includes the week-over-week volume delta and a direction flag:
 *   - 'up'   when delta > +5 % of the prior week
 *   - 'down' when delta < -5 % of the prior week
 *   - 'flat' otherwise (including the first observed week)
 */
export function computeVolumeTrend(
  samples: ExerciseHistorySample[],
  opts: VolumeTrendOptions,
): VolumeTrendPoint[] {
  // weekStart → groupKey → total volume
  const volumeMap = new Map<string, Map<string, number>>();

  for (const sample of samples) {
    const weekStart = getMondayIso(sample.workoutDate);
    const groupKey =
      opts.groupBy === 'muscleGroup' ? sample.muscleGroup : sample.exerciseId;

    if (!volumeMap.has(weekStart)) volumeMap.set(weekStart, new Map());
    const weekMap = volumeMap.get(weekStart)!;

    const volume = sample.sets.reduce((sum, s) => sum + s.weight * s.reps, 0);
    weekMap.set(groupKey, (weekMap.get(groupKey) ?? 0) + volume);
  }

  // Collect all observed group keys
  const allGroupKeys = new Set<string>();
  for (const weekMap of volumeMap.values()) {
    for (const key of weekMap.keys()) allGroupKeys.add(key);
  }

  // Build a contiguous Monday week list anchored to the latest observed week,
  // so zero-volume weeks are filled and deltas compare true calendar neighbours.
  const observedWeeks = [...volumeMap.keys()].sort();
  const sortedWeeks: string[] = [];
  if (observedWeeks.length > 0) {
    const latestWeek = observedWeeks[observedWeeks.length - 1]!;
    const parts = latestWeek.split('-').map(Number);
    const y = parts[0]!;
    const m = parts[1]!;
    const d = parts[2]!;
    for (let i = opts.weeks - 1; i >= 0; i--) {
      sortedWeeks.push(toIsoDateString(new Date(y, m - 1, d - i * 7)));
    }
  }

  const results: VolumeTrendPoint[] = [];

  for (const groupKey of allGroupKeys) {
    let prevVolume: number | null = null;

    for (const weekStart of sortedWeeks) {
      const totalVolume = volumeMap.get(weekStart)?.get(groupKey) ?? 0;

      let deltaVolume: number | null = null;
      let direction: VolumeTrendPoint['direction'] = 'flat';

      if (prevVolume !== null) {
        deltaVolume = totalVolume - prevVolume;
        if (prevVolume === 0) {
          direction = totalVolume > 0 ? 'up' : 'flat';
        } else {
          const deltaPct = deltaVolume / prevVolume;
          if (deltaPct > 0.05) direction = 'up';
          else if (deltaPct < -0.05) direction = 'down';
          else direction = 'flat';
        }
      }

      results.push({ weekStart, groupKey, totalVolume, deltaVolume, direction });
      prevVolume = totalVolume;
    }
  }

  return results;
}
