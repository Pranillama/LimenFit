import { getMondayDate, toIsoDateString } from './weekHelpers';
import type { WorkoutSample, ConsistencyScore } from './types';

export interface ConsistencyOptions {
  now: Date;
  /** Number of weeks to analyse, counting back from the week containing `now`. Default 4. */
  weeks?: number;
  /** Minimum completed workouts per week to count toward the streak. Default 3. */
  targetPerWeek?: number;
}

/**
 * Computes average workouts per week and a trailing qualifying-week streak.
 *
 * Streak: consecutive weeks ending with the current week where completed
 * workout count ≥ `targetPerWeek`. The current (possibly partial) week is
 * included so in-progress streaks are visible.
 */
export function computeConsistencyScore(
  workouts: WorkoutSample[],
  opts: ConsistencyOptions,
): ConsistencyScore {
  const weeks = opts.weeks ?? 4;
  const target = opts.targetPerWeek ?? 3;

  // Build the N week-Monday buckets ending with the current week (local time)
  const currentMonday = getMondayDate(opts.now);
  const buckets: string[] = [];

  for (let i = weeks - 1; i >= 0; i--) {
    const d = new Date(
      currentMonday.getFullYear(),
      currentMonday.getMonth(),
      currentMonday.getDate() - i * 7,
    );
    buckets.push(toIsoDateString(d));
  }

  // Count completed workouts per bucket
  const countPerWeek = new Map<string, number>(buckets.map((b) => [b, 0]));

  for (const w of workouts) {
    if (w.status !== 'completed') continue;
    const weekKey = toIsoDateString(getMondayDate(new Date(w.startedAt)));
    if (countPerWeek.has(weekKey)) {
      countPerWeek.set(weekKey, countPerWeek.get(weekKey)! + 1);
    }
  }

  const counts = buckets.map((b) => countPerWeek.get(b)!);

  const avgWorkoutsPerWeek =
    weeks === 0 ? 0 : counts.reduce((s, c) => s + c, 0) / weeks;

  // Trailing streak from most recent → oldest
  let streakWeeks = 0;
  for (let i = buckets.length - 1; i >= 0; i--) {
    if ((counts[i] ?? 0) >= target) streakWeeks++;
    else break;
  }

  return { avgWorkoutsPerWeek, streakWeeks, weeksAnalyzed: weeks };
}
