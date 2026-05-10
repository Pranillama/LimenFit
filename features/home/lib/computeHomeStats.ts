import { getWeekRange } from './dateHelpers';
import type { HomeWorkoutSummary } from './homeDashboardDTO';

export interface HomeQuickStats {
  workoutsThisWeek: number;
  daysTrained: number;
}

export function computeQuickStats(rows: HomeWorkoutSummary[], now: Date): HomeQuickStats {
  const { start, endExclusive } = getWeekRange(now);

  const inWeek = rows.filter((row) => {
    if (row.status !== 'completed') return false;
    const t = new Date(row.startedAt).getTime();
    return t >= start.getTime() && t < endExclusive.getTime();
  });

  const uniqueDays = new Set(
    inWeek.map((row) => {
      const d = new Date(row.startedAt);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    }),
  );

  return {
    workoutsThisWeek: inWeek.length,
    daysTrained: uniqueDays.size,
  };
}
