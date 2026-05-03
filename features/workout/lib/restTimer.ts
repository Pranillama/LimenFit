import type { RestTimerEntry } from '../store/types';

// TODO(T15): replace with user_settings.rest_timer_default_seconds
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
