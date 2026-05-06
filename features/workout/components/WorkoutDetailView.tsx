'use client';

import * as React from 'react';

import { Button } from '@/components/ui/button';
import { useExerciseLookup } from '../hooks/useExerciseLookup';
import { autoNameWorkout, formatDuration } from '../lib/format';

export interface WorkoutDetailDTO {
  id: string;
  name: string | null;
  status: 'completed' | 'expired';
  started_at: string;
  completed_at: string | null;
  expired_at: string | null;
  last_activity_at: string;
  plan_workout_id: string | null;
  planName: string | null;
  exercises: Array<{
    id: string;
    exercise_id: string;
    position: number;
    sets: Array<{
      localId: string;
      set_number: number;
      weight_value: number | null;
      weight_unit: string | null;
      reps: number | null;
    }>;
  }>;
}

interface Props {
  workout: WorkoutDetailDTO;
}

const dateFormat = new Intl.DateTimeFormat(undefined, {
  weekday: 'short',
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});

export function WorkoutDetailView({ workout }: Props) {
  const lookup = useExerciseLookup();

  const exerciseNames = workout.exercises.map((ex) => lookup.nameOf(ex.exercise_id));
  const resolvedName =
    (workout.name ?? '').trim() ||
    autoNameWorkout(exerciseNames.filter(Boolean)) ||
    'Workout';

  const endIso =
    workout.completed_at ??
    workout.expired_at ??
    workout.last_activity_at;

  const duration = formatDuration(workout.started_at, endIso);
  const dateLabel = dateFormat.format(new Date(workout.started_at));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{resolvedName}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{dateLabel}</p>
        <p className="mt-0.5 text-sm text-muted-foreground">{duration}</p>
      </div>

      {/* Plan reference */}
      {workout.planName && (
        <p className="text-sm text-muted-foreground">
          From plan: <span className="font-medium text-foreground">{workout.planName}</span>
        </p>
      )}

      {/* Expired callout */}
      {workout.status === 'expired' && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800/40 dark:bg-amber-900/20 dark:text-amber-300">
          Expired draft — this workout was not completed.
        </div>
      )}

      {/* Exercise list */}
      {workout.exercises.length > 0 ? (
        <div className="space-y-4">
          {workout.exercises.map((ex) => {
            const name = lookup.nameOf(ex.exercise_id) || 'Exercise';
            return (
              <div key={ex.id} className="rounded-lg border bg-card">
                <div className="px-4 py-3 font-medium">{name}</div>
                {ex.sets.length > 0 && (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-t text-xs text-muted-foreground">
                        <th className="px-4 py-1.5 text-left font-medium">Set</th>
                        <th className="px-4 py-1.5 text-left font-medium">Weight</th>
                        <th className="px-4 py-1.5 text-left font-medium">Reps</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ex.sets.map((s) => (
                        <tr key={s.localId} className="border-t">
                          <td className="px-4 py-2">{s.set_number}</td>
                          <td className="px-4 py-2">
                            {s.weight_value != null
                              ? `${s.weight_value}${s.weight_unit ? ` ${s.weight_unit}` : ''}`
                              : '—'}
                          </td>
                          <td className="px-4 py-2">{s.reps ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No exercises logged.</p>
      )}

      {/* Action buttons */}
      <div className="flex flex-col gap-3 pt-2">
        <Button
          onClick={() => {
            // TODO: wire repeat-workout action in next phase
          }}
        >
          Repeat Workout
        </Button>

        {workout.status === 'expired' && (
          <Button
            variant="outline"
            onClick={() => {
              // TODO: wire restore action in next phase
            }}
          >
            Restore
          </Button>
        )}

        <Button
          variant="destructive"
          onClick={() => {
            // TODO: wire delete action in next phase
          }}
        >
          Delete
        </Button>
      </div>
    </div>
  );
}
