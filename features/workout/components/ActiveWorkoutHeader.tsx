'use client';

import * as React from 'react';

import { Button } from '@/components/ui/button';

import { formatElapsed } from '../lib/format';
import { selectActiveDraftMeta, selectSyncBadge, selectSyncState } from '../store/selectors';
import { useActiveWorkoutStore } from '../store/useActiveWorkoutStore';

interface ActiveWorkoutHeaderProps {
  hasExercises: boolean;
  now: number;
  onCancel: () => void;
  onEndWorkout: () => void;
}

export function ActiveWorkoutHeader({
  hasExercises,
  now,
  onCancel,
  onEndWorkout,
}: ActiveWorkoutHeaderProps) {
  const meta = useActiveWorkoutStore(selectActiveDraftMeta);
  const syncBadge = useActiveWorkoutStore(selectSyncBadge);
  const syncState = useActiveWorkoutStore(selectSyncState);

  if (!meta) return null;

  const title = (meta.name ?? '').trim() || 'Workout';
  const elapsed = formatElapsed(meta.startedAt, now);

  return (
    <header className="sticky top-0 z-10 flex items-center gap-2 border-b bg-background px-4 py-2">
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm font-semibold">{title}</span>
        <span className="text-xs tabular-nums text-muted-foreground">{elapsed}</span>
      </div>

      {syncBadge !== null && (
        <span className="shrink-0 text-xs text-muted-foreground">
          {syncState.flushing ? '● Syncing…' : `Sync pending (${syncBadge})`}
        </span>
      )}

      <Button variant="ghost" size="icon" aria-label="Cancel workout" onClick={onCancel}>
        ✕
      </Button>

      <Button
        variant="destructive"
        size="sm"
        aria-label="End workout"
        disabled={!hasExercises}
        onClick={onEndWorkout}
      >
        End Workout
      </Button>
    </header>
  );
}
