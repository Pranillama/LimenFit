/**
 * Local-time week utilities shared across the insights compute kernel.
 * Mirrors the Monday-to-Monday convention in features/home/lib/dateHelpers.ts.
 * No framework imports — safe in Node test environments.
 */

/** Returns the Monday of the ISO week that contains `date`, in local time. */
export function getMondayDate(date: Date): Date {
  const day = date.getDay(); // 0 = Sunday
  const daysFromMonday = (day + 6) % 7;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() - daysFromMonday);
}

/** Formats a local-time Date as a YYYY-MM-DD string. */
export function toIsoDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Returns the Monday ISO date (YYYY-MM-DD) of the week that contains the
 * timestamp represented by `isoString`. Uses local getters so the bucket
 * matches the user's wall-clock day, not UTC.
 */
export function getMondayIso(isoString: string): string {
  return toIsoDateString(getMondayDate(new Date(isoString)));
}
