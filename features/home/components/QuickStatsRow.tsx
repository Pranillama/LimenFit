import type { HomeQuickStats } from '../lib/computeHomeStats';

interface Props {
  stats: HomeQuickStats;
}

export function QuickStatsRow({ stats }: Props) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="rounded-lg border bg-card p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Workouts This Week
        </p>
        <p className="mt-1 text-2xl font-semibold">{stats.workoutsThisWeek}</p>
      </div>
      <div className="rounded-lg border bg-card p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Days Trained
        </p>
        <p className="mt-1 text-2xl font-semibold">{stats.daysTrained}</p>
      </div>
    </div>
  );
}
