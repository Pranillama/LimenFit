/**
 * Formats elapsed time as "M:SS" (under an hour) or "H:MM:SS" (one hour or more).
 * Suitable for the live header timer during an active workout.
 */
export function formatElapsed(startIso: string, now: number): string {
  const totalSeconds = Math.max(0, Math.floor((now - new Date(startIso).getTime()) / 1000));
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** Formats a rest countdown as "M:SS". */
export function formatRest(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/**
 * Returns a human-readable workout duration for the summary screen,
 * e.g. "1h 23m", "45m 10s", "30s".
 */
export function formatDuration(startIso: string, endIso: string): string {
  const totalSeconds = Math.max(
    0,
    Math.floor((new Date(endIso).getTime() - new Date(startIso).getTime()) / 1000),
  );
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const parts: string[] = [];
  if (h > 0) parts.push(`${h}h`);
  if (m > 0) parts.push(`${m}m`);
  if (s > 0 || parts.length === 0) parts.push(`${s}s`);
  return parts.join(' ');
}

/**
 * Produces a workout auto-name from a list of exercise names.
 * - Empty list → ""
 * - 1 exercise → the exercise name
 * - 2+ exercises → "<First> + N more"  (e.g. "Bench Press + 3 more")
 */
export function autoNameWorkout(exerciseNames: string[]): string {
  if (exerciseNames.length === 0) return '';
  const first = exerciseNames[0] ?? '';
  if (exerciseNames.length === 1) return first;
  const more = exerciseNames.length - 1;
  return `${first} + ${more} more`;
}
