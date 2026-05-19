import Link from 'next/link';

import { formatDuration } from '@/features/workout/lib/format';
import type { HomeWorkoutSummary } from '../lib/homeDashboardDTO';

type ActivityRow = HomeWorkoutSummary & { formattedDate: string };

interface Props {
  rows: ActivityRow[];
}

export function RecentActivityList({ rows }: Props) {
  return (
    <section>
      <p className="mb-2 text-sm font-medium uppercase tracking-wide text-muted-foreground">
        Recent Activity
      </p>

      {rows.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          No completed workouts yet — start one from above.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {rows.map((row) => (
            <li key={row.id} className="overflow-hidden rounded-lg border bg-card">
              <Link
                href={`/train/history/${row.id}`}
                className="block px-4 py-3 transition-colors hover:bg-accent"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{row.name}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{row.formattedDate}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatDuration(row.startedAt, row.endedAt ?? row.startedAt)} &middot;{' '}
                      {row.exerciseCount} {row.exerciseCount === 1 ? 'exercise' : 'exercises'}{' '}
                      &middot; {row.setCount} {row.setCount === 1 ? 'set' : 'sets'}
                    </p>
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
