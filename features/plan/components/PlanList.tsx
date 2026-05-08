import * as React from 'react';
import Link from 'next/link';

export interface PlanRowDTO {
  id: string;
  name: string;
  workoutCount: number;
  exerciseCount: number;
}

interface Props {
  rows: PlanRowDTO[];
}

export function PlanList({ rows }: Props) {
  if (rows.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No plans yet — create one to get started.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {rows.map((row) => (
        <li key={row.id} className="overflow-hidden rounded-lg border bg-card">
          <Link
            href={`/train/plans/${row.id}`}
            className="block px-4 py-3 transition-colors hover:bg-accent"
          >
            <p className="truncate font-medium">{row.name}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {row.workoutCount} {row.workoutCount === 1 ? 'workout' : 'workouts'} &middot;{' '}
              {row.exerciseCount} {row.exerciseCount === 1 ? 'exercise' : 'exercises'}
            </p>
          </Link>
        </li>
      ))}
    </ul>
  );
}
