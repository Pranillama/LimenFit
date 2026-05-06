'use client';

import * as React from 'react';
import Link from 'next/link';

import { autoNameWorkout, formatDuration } from '../lib/format';
import { useActiveWorkoutStore } from '../store/useActiveWorkoutStore';
import { useExerciseLookup } from '../hooks/useExerciseLookup';
import { useRestoreWorkoutMutation } from '../hooks/useRestoreWorkoutMutation';

export interface HistoryRowDTO {
  id: string;
  name: string;
  startedAt: string;
  durationLabel: string;
  exerciseCount: number;
  setCount: number;
  status: 'completed' | 'expired';
}

interface Props {
  rows: HistoryRowDTO[];
}

const dateFormat = new Intl.DateTimeFormat(undefined, {
  weekday: 'short',
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});

export function HistoryList({ rows }: Props) {
  const meta = useActiveWorkoutStore((s) => s.meta);
  const exercises = useActiveWorkoutStore((s) => s.exercises);
  const lookup = useExerciseLookup();
  const restoreWorkout = useRestoreWorkoutMutation();

  const localWorkoutId = meta?.status === 'completed_local' ? (meta.workoutId ?? null) : null;
  const serverIds = new Set(rows.map((r) => r.id));

  // Synthesize a top entry when completed_local but not yet in the server list
  const showSyntheticRow =
    meta?.status === 'completed_local' && (localWorkoutId === null || !serverIds.has(localWorkoutId));

  const synthetic = React.useMemo(() => {
    if (!showSyntheticRow || !meta) return null;
    const names = lookup.isLoading
      ? []
      : exercises.map((ex) => lookup.nameOf(ex.exerciseId)).filter(Boolean);
    const name =
      (meta.name ?? '').trim() || autoNameWorkout(names) || 'Workout';
    const durationLabel = formatDuration(meta.startedAt, meta.lastActivityAt);
    const seenIds = new Set<string>();
    for (const ex of exercises) seenIds.add(ex.exerciseId);
    const exerciseCount = seenIds.size;
    const setCount = exercises.reduce((sum, ex) => sum + ex.sets.length, 0);
    const dateLabel = dateFormat.format(new Date(meta.startedAt));
    return { name, durationLabel, exerciseCount, setCount, dateLabel };
  }, [showSyntheticRow, meta, exercises, lookup]);

  if (!showSyntheticRow && rows.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No workouts yet — log one from the Train tab.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {showSyntheticRow && synthetic && (
        <li className="rounded-lg border bg-card px-4 py-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{synthetic.name}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{synthetic.dateLabel}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {synthetic.durationLabel} &middot; {synthetic.exerciseCount}{' '}
                {synthetic.exerciseCount === 1 ? 'exercise' : 'exercises'} &middot;{' '}
                {synthetic.setCount} {synthetic.setCount === 1 ? 'set' : 'sets'}
              </p>
            </div>
            <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
              Sync pending
            </span>
          </div>
        </li>
      )}

      {rows.map((row) => {
        const isSyncPending =
          meta?.status === 'completed_local' && localWorkoutId === row.id;

        return (
          <li key={row.id} className="overflow-hidden rounded-lg border bg-card">
            <Link
              href={`/train/history/${row.id}`}
              className="block px-4 py-3 transition-colors hover:bg-accent"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{row.name}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {dateFormat.format(new Date(row.startedAt))}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {row.durationLabel} &middot; {row.exerciseCount}{' '}
                    {row.exerciseCount === 1 ? 'exercise' : 'exercises'} &middot; {row.setCount}{' '}
                    {row.setCount === 1 ? 'set' : 'sets'}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  {isSyncPending && (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                      Sync pending
                    </span>
                  )}
                  {row.status === 'expired' && (
                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                      Expired
                    </span>
                  )}
                </div>
              </div>
            </Link>
            {row.status === 'expired' && (
              <div className="flex justify-end px-4 pb-2">
                {restoreWorkout.isPending && restoreWorkout.variables?.id === row.id ? (
                  <span className="flex items-center gap-1.5 rounded px-2 py-0.5 text-xs text-primary opacity-70">
                    <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    Restoring…
                  </span>
                ) : (
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      restoreWorkout.mutate({ id: row.id });
                    }}
                    disabled={restoreWorkout.isPending}
                    className="rounded px-2 py-0.5 text-xs text-primary hover:underline disabled:opacity-50"
                    aria-label={`Restore workout ${row.name}`}
                  >
                    Restore
                  </button>
                )}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
