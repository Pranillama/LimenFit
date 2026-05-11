import type { RestTimerEntry } from '../store/types';

/** SSR-safe fallback; runtime source of truth is `useActiveWorkoutStore.getState().settings.restTimerDefaultSeconds`. */
export const DEFAULT_REST_SECONDS = 90;

/**
 * Returns seconds remaining for a rest timer entry, clamped at 0.
 * For a paused entry, `durationSeconds` already encodes the remaining time at pause.
 * For a running entry, remaining is computed against the current `now` timestamp (ms).
 */
export function restRemaining(entry: RestTimerEntry, now: number): number {
  if (entry.paused) {
    return Math.max(0, entry.durationSeconds);
  }
  const elapsedSeconds = (now - new Date(entry.startedAt).getTime()) / 1000;
  return Math.max(0, entry.durationSeconds - elapsedSeconds);
}
