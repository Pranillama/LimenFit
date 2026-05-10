/**
 * Returns true when the ISO string and `now` fall on the same calendar day
 * in the user's local timezone.
 */
export function isSameLocalDay(iso: string, now: Date): boolean {
  const d = new Date(iso);
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

/**
 * Returns the Monday-to-Monday week range enclosing `now`, in local time.
 * `start` is Monday 00:00:00.000, `endExclusive` is the following Monday 00:00:00.000.
 */
export function getWeekRange(now: Date): { start: Date; endExclusive: Date } {
  const day = now.getDay(); // 0 = Sunday, 1 = Monday, …
  const daysFromMonday = (day + 6) % 7; // Monday = 0

  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysFromMonday);
  const endExclusive = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 7);

  return { start, endExclusive };
}
