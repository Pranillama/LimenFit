import type { ExerciseHistorySample, OneRepMaxPoint, WeightUnit, SetSample } from './types';

/**
 * Epley formula: weight × (1 + reps / 30).
 * Reps are clamped to ≥ 1; a single-rep set returns the weight unchanged.
 */
export function estimateOneRepMax(weight: number, reps: number): number {
  const r = Math.max(1, reps);
  if (r === 1) return weight;
  return weight * (1 + r / 30);
}

/**
 * Resolves the dominant weight unit for a set of samples.
 * Returns undefined when units are evenly split and no preferred unit is
 * supplied — the caller should skip (drop) the sample.
 */
function resolveDominantUnit(
  sets: SetSample[],
  preferredUnit?: WeightUnit,
): WeightUnit | undefined {
  const counts = new Map<WeightUnit, number>();
  for (const s of sets) {
    counts.set(s.weightUnit, (counts.get(s.weightUnit) ?? 0) + 1);
  }
  if (counts.size === 0) return undefined;
  if (counts.size === 1) return [...counts.keys()][0];

  let dominant: WeightUnit | undefined;
  let topCount = 0;
  let tied = false;

  for (const [unit, count] of counts) {
    if (count > topCount) {
      dominant = unit;
      topCount = count;
      tied = false;
    } else if (count === topCount) {
      tied = true;
    }
  }

  return tied ? preferredUnit : dominant;
}

/**
 * Produces one `OneRepMaxPoint` per workout+exercise combination — the highest
 * Epley e1RM across all sets for that exercise in that workout, merging any
 * duplicate exercise rows that share the same workoutId and exerciseId.
 *
 * Mixed-unit sets: only sets that match the dominant unit are used.
 * When the unit split is exactly even and no `preferredUnit` is supplied the
 * group is silently dropped.
 */
export function computeOneRepMaxSeries(
  samples: ExerciseHistorySample[],
  opts?: { preferredUnit?: WeightUnit },
): OneRepMaxPoint[] {
  // Group by workoutId + exerciseId to deduplicate duplicate workout-exercise rows
  const grouped = new Map<string, ExerciseHistorySample[]>();
  for (const sample of samples) {
    const key = `${sample.workoutId}:${sample.exerciseId}`;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(sample);
  }

  const results: OneRepMaxPoint[] = [];

  for (const group of grouped.values()) {
    const allSets = group.flatMap((s) => s.sets);
    if (allSets.length === 0) continue;

    const unit = resolveDominantUnit(allSets, opts?.preferredUnit);
    if (!unit) continue;

    const validSets = allSets.filter((s) => s.weightUnit === unit && s.weight > 0);
    if (validSets.length === 0) continue;

    let best = 0;
    let topSet = validSets[0];
    for (const s of validSets) {
      const e = estimateOneRepMax(s.weight, s.reps);
      if (e > best) best = e;
      if (s.weight > topSet.weight) topSet = s;
    }

    const first = group[0];
    results.push({
      workoutId: first.workoutId,
      workoutDate: first.workoutDate,
      exerciseId: first.exerciseId,
      exerciseName: first.exerciseName,
      e1rm: best,
      weightUnit: unit,
      topSetWeight: topSet.weight,
      topSetReps: topSet.reps,
    });
  }

  return results;
}
