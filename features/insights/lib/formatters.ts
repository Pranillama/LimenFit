/**
 * Formats a volume value with its weight unit — used in chart tooltips and axis labels.
 * Never surfaces a raw number without a unit (acceptance requirement).
 */
export function formatVolume(value: number, unit: 'lbs' | 'kg'): string {
  return `${Math.round(value).toLocaleString()} ${unit}`;
}

/**
 * Formats a Date as a short "Mon D" label for ISO-week X-axis ticks, e.g. "May 5".
 * Parse weekStart strings as local midnight ("YYYY-MM-DDT00:00:00") so UTC offset
 * does not shift the displayed day.
 */
export function formatWeekLabel(date: Date): string {
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
