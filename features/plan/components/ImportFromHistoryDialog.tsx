'use client';

import * as React from 'react';

import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { autoNameWorkout } from '@/features/workout/lib/format';
import { useExerciseLookup } from '@/features/workout/hooks/useExerciseLookup';

import { useImportableWorkoutsQuery, type ImportableWorkout } from '../hooks/useImportableWorkoutsQuery';

export type { ImportableWorkout };

const dateFormat = new Intl.DateTimeFormat(undefined, {
  weekday: 'short',
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});

interface ImportFromHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (workout: ImportableWorkout) => void;
}

export function ImportFromHistoryDialog({
  open,
  onOpenChange,
  onImport,
}: ImportFromHistoryDialogProps) {
  const { data: workouts = [], isLoading } = useImportableWorkoutsQuery();
  const lookup = useExerciseLookup();

  function getDisplayName(workout: ImportableWorkout): string {
    if (workout.name?.trim()) return workout.name.trim();
    if (lookup.isLoading) return autoNameWorkout([]) || 'Workout';
    const sorted = workout.workout_exercises
      .slice()
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
    const seenIds = new Set<string>();
    const unique = sorted.filter((we) => {
      if (seenIds.has(we.exercise_id)) return false;
      seenIds.add(we.exercise_id);
      return true;
    });
    const names = unique.map((we) => lookup.nameOf(we.exercise_id)).filter(Boolean);
    return autoNameWorkout(names) || 'Workout';
  }

  function getUniqueExerciseCount(workout: ImportableWorkout): number {
    return new Set(workout.workout_exercises.map((we) => we.exercise_id)).size;
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="flex h-[80dvh] max-h-[80dvh] w-full max-w-full flex-col rounded-t-lg border-0 p-0 sm:max-w-md sm:rounded-l-lg"
      >
        <SheetHeader className="border-b px-4 py-3">
          <SheetTitle>Import from History</SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-4 py-3">
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full rounded-lg" />
              ))}
            </div>
          ) : workouts.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No completed workouts yet.
            </p>
          ) : (
            <ul className="space-y-3">
              {workouts.map((workout) => {
                const name = getDisplayName(workout);
                const date = dateFormat.format(new Date(workout.started_at));
                const exerciseCount = getUniqueExerciseCount(workout);

                return (
                  <li key={workout.id}>
                    <button
                      type="button"
                      className="w-full rounded-lg border bg-card px-4 py-3 text-left transition-colors hover:bg-accent"
                      onClick={() => {
                        onImport(workout);
                        onOpenChange(false);
                      }}
                    >
                      <p className="truncate font-medium">{name}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{date}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {exerciseCount} {exerciseCount === 1 ? 'exercise' : 'exercises'}
                      </p>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
