interface Props {
  workoutsThisWeek: number;
  consistencyMessage: string;
}

export function QuickStatsRow({ workoutsThisWeek, consistencyMessage }: Props) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="rounded-lg border bg-card p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Workouts This Week
        </p>
        <p className="mt-1 text-2xl font-semibold">{workoutsThisWeek}</p>
      </div>
      <div className="rounded-lg border bg-card p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Consistency
        </p>
        <p className="mt-1 text-sm font-medium leading-snug">{consistencyMessage}</p>
      </div>
    </div>
  );
}
