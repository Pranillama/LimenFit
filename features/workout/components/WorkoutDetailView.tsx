'use client';

import * as React from 'react';

import { DiscardConfirmationDialog } from '@/components/discard-confirmation-dialog';
import { Button } from '@/components/ui/button';
import { useExerciseLookup } from '../hooks/useExerciseLookup';
import { useDeleteWorkoutMutation } from '../hooks/useDeleteWorkoutMutation';
import { useEditSetMutation } from '../hooks/useEditSetMutation';
import { useRestoreWorkoutMutation } from '../hooks/useRestoreWorkoutMutation';
import { autoNameWorkout, formatDuration } from '../lib/format';
import { buildRepeatIntent } from '../lib/repeatWorkout';
import { useStartWorkoutAction } from '../hooks/useStartWorkoutAction';

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

// Inline-editable cell for weight or reps on a completed workout set.
// Debounces the save by 400 ms while the field is focused to coalesce keystrokes.
interface InlineCellProps {
  value: number | null;
  min: number;
  isInteger: boolean;
  disabled: boolean;
  onSave: (value: number, rollback: () => void) => void;
}

function InlineCell({ value, min, isInteger, disabled, onSave }: InlineCellProps) {
  const [draft, setDraft] = React.useState<string>(value != null ? String(value) : '');
  const [invalid, setInvalid] = React.useState(false);
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep local draft in sync when parent data refreshes (e.g. after router.refresh).
  const valueRef = React.useRef(value);
  React.useEffect(() => {
    if (!disabled && value !== valueRef.current) {
      valueRef.current = value;
      setDraft(value != null ? String(value) : '');
    }
  }, [value, disabled]);

  function clearTimer() {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }

  function tryCommit(raw: string) {
    clearTimer();
    const n = Number(raw);
    const isValid = raw !== '' && !isNaN(n) && n >= min && (!isInteger || Number.isInteger(n));
    if (!isValid) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    onSave(n, () => {
      setDraft(value != null ? String(value) : '');
      setInvalid(false);
    });
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value;
    setDraft(raw);
    setInvalid(false);
    clearTimer();
    timerRef.current = setTimeout(() => tryCommit(raw), 400);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault();
      tryCommit(draft);
    }
  }

  function handleBlur() {
    tryCommit(draft);
  }

  // Clean up any pending timer on unmount.
  React.useEffect(() => () => clearTimer(), []);

  if (disabled) {
    return <span>{value != null ? value : '—'}</span>;
  }

  return (
    <input
      type="number"
      inputMode="decimal"
      value={draft}
      min={min}
      step={isInteger ? 1 : 'any'}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      onBlur={handleBlur}
      aria-invalid={invalid || undefined}
      className={[
        'w-16 rounded border bg-transparent px-1 py-0.5 text-center text-sm',
        'focus:outline-none focus:ring-1 focus:ring-ring',
        invalid ? 'border-destructive' : 'border-transparent hover:border-input focus:border-input',
      ].join(' ')}
    />
  );
}

export function WorkoutDetailView({ workout }: Props) {
  const lookup = useExerciseLookup();
  const editSet = useEditSetMutation();
  const deleteWorkout = useDeleteWorkoutMutation();
  const restoreWorkout = useRestoreWorkoutMutation();
  const startWorkout = useStartWorkoutAction();
  const [showDeleteDialog, setShowDeleteDialog] = React.useState(false);

  const exerciseNames = workout.exercises.map((ex) => lookup.nameOf(ex.exercise_id));
  const resolvedName =
    (workout.name ?? '').trim() || autoNameWorkout(exerciseNames.filter(Boolean)) || 'Workout';

  const endIso = workout.completed_at ?? workout.expired_at ?? workout.last_activity_at;

  const duration = formatDuration(workout.started_at, endIso);
  const dateLabel = dateFormat.format(new Date(workout.started_at));

  // Inline editing is disabled for expired drafts (must restore first).
  const editDisabled = workout.status === 'expired';

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
                            <span className="inline-flex items-center gap-1">
                              <InlineCell
                                value={s.weight_value}
                                min={0}
                                isInteger={false}
                                disabled={editDisabled}
                                onSave={(v, rollback) =>
                                  editSet.mutate(
                                    { id: s.localId, weightValue: v },
                                    { onError: rollback },
                                  )
                                }
                              />
                              {s.weight_unit && (
                                <span className="text-xs text-muted-foreground">
                                  {s.weight_unit}
                                </span>
                              )}
                            </span>
                          </td>
                          <td className="px-4 py-2">
                            <InlineCell
                              value={s.reps}
                              min={1}
                              isInteger={true}
                              disabled={editDisabled}
                              onSave={(v, rollback) =>
                                editSet.mutate({ id: s.localId, reps: v }, { onError: rollback })
                              }
                            />
                          </td>
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
        {workout.status === 'expired' ? (
          <Button
            onClick={() => restoreWorkout.mutate({ id: workout.id })}
            disabled={restoreWorkout.isPending}
          >
            {restoreWorkout.isPending ? (
              <span className="flex items-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                Restoring…
              </span>
            ) : (
              'Restore Workout'
            )}
          </Button>
        ) : (
          <Button onClick={() => void startWorkout(buildRepeatIntent(workout.exercises))}>
            Repeat Workout
          </Button>
        )}

        <Button variant="destructive" onClick={() => setShowDeleteDialog(true)}>
          Delete
        </Button>
      </div>

      <DiscardConfirmationDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        title="Delete this workout?"
        description="This cannot be undone."
        discardLabel="Delete"
        keepEditingLabel="Cancel"
        onDiscard={() => {
          setShowDeleteDialog(false);
          deleteWorkout.mutate({ id: workout.id });
        }}
      />
    </div>
  );
}
