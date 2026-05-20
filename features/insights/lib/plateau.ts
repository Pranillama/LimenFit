import type { OneRepMaxPoint, PlateauSignal } from './types';

export interface PlateauOptions {
  /** Minimum sessions required before an exercise can be flagged. Default 4. */
  minSessions?: number;
  /** Signed e1RM change (first → last in window) below which the exercise is plateauing. Default 2. */
  flatThresholdPct?: number;
}

/**
 * Flags exercises whose e1RM has not improved meaningfully over their last N
 * sessions.
 *
 * Plateau criteria (both must hold):
 *   - At least `minSessions` data points exist for the exercise.
 *   - The signed percentage change from the first to the last e1RM in that
 *     window is below `flatThresholdPct` (capturing flat AND declining trends).
 *
 * Exercises with fewer than `minSessions` are omitted from the output.
 */
export function detectPlateaus(
  perExerciseSeries: OneRepMaxPoint[],
  opts?: PlateauOptions,
): PlateauSignal[] {
  const minSessions = opts?.minSessions ?? 4;
  const flatThreshold = opts?.flatThresholdPct ?? 2;

  // Group by exerciseId
  const byExercise = new Map<string, OneRepMaxPoint[]>();
  for (const point of perExerciseSeries) {
    if (!byExercise.has(point.exerciseId)) byExercise.set(point.exerciseId, []);
    byExercise.get(point.exerciseId)!.push(point);
  }

  const results: PlateauSignal[] = [];

  for (const [exerciseId, points] of byExercise) {
    if (points.length < minSessions) continue;

    // Chronological order; examine the last `minSessions` sessions
    const sorted = points.slice().sort((a, b) => a.workoutDate.localeCompare(b.workoutDate));
    const window = sorted.slice(-minSessions);

    const firstE1rm = window[0]!.e1rm;
    const lastE1rm = window[window.length - 1]!.e1rm;

    const e1rmChangePct = firstE1rm === 0 ? 0 : ((lastE1rm - firstE1rm) / firstE1rm) * 100;

    const topSetImproving = window[window.length - 1]!.topSetWeight > window[0]!.topSetWeight;

    results.push({
      exerciseId,
      exerciseName: points[0]!.exerciseName,
      sessionsAnalyzed: window.length,
      e1rmChangePct,
      topSetImproving,
      isPlateauing: e1rmChangePct < flatThreshold || !topSetImproving,
    });
  }

  return results;
}
