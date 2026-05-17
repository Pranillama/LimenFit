'use client';

import * as React from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import { useExerciseLookup } from '../hooks/useExerciseLookup';
import { autoNameWorkout, formatDuration } from '../lib/format';
import { selectSyncBadge } from '../store/selectors';
import type { ActiveSet } from '../store/types';
import { clearCompletedSession, useActiveWorkoutStore } from '../store/useActiveWorkoutStore';

interface Props {
  onResume(): void;
}

function formatVolume(sets: ActiveSet[]): string {
  if (sets.length === 0) return '—';
  const total = sets.reduce((sum, s) => sum + (s.weightValue ?? 0) * (s.reps ?? 0), 0);
  const units = new Set(sets.map((s) => s.weightUnit));
  const unit = units.size === 1 ? [...units][0] : null;
  return unit ? `${total} ${unit}` : String(total);
}

export function EndWorkoutSummary({ onResume }: Props) {
  const meta = useActiveWorkoutStore((s) => s.meta);
  const exercises = useActiveWorkoutStore((s) => s.exercises);
  const syncBadge = useActiveWorkoutStore(selectSyncBadge);
  const lookup = useExerciseLookup();

  const exerciseNames = exercises.map((ex) => lookup.nameOf(ex.exerciseId));
  const autoName = autoNameWorkout(exerciseNames.filter(Boolean));

  const [name, setName] = React.useState(() => meta?.name ?? '');
  const [userEdited, setUserEdited] = React.useState(false);

  // Seed name once the exercise lookup resolves; skip if user has already typed
  // or if a non-auto name was restored from meta.
  React.useEffect(() => {
    if (lookup.isLoading) return;
    setName((prev) => (userEdited || prev !== '' ? prev : autoName));
  }, [lookup.isLoading, autoName, userEdited]);

  if (!meta) return null;

  const isInProgress = meta.status === 'in_progress';
  const isCompletedSynced = meta.status === 'completed_synced';
  const endIso =
    meta.status !== 'in_progress'
      ? (meta.lastActivityAt ?? new Date().toISOString())
      : new Date().toISOString();

  const totalSets = exercises.reduce((sum, ex) => sum + ex.sets.length, 0);

  const dateStr = new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(meta.startedAt));

  function handleSave() {
    const resolvedAutoName = autoNameWorkout(
      exercises.map((ex) => lookup.nameOf(ex.exerciseId)).filter(Boolean),
    );
    const resolvedName = name.trim() || resolvedAutoName;
    useActiveWorkoutStore.getState().endWorkout({ name: resolvedName });
  }

  return (
    <div className="space-y-6 px-4 py-6 md:px-6 md:py-8">
      {syncBadge !== null && (
        <div className="flex items-center gap-2 rounded-md bg-muted px-3 py-2 text-sm">
          <span aria-hidden="true">{syncBadge}</span>
          <span className="text-muted-foreground">
            {syncBadge === '●' ? 'Syncing…' : `${syncBadge} pending`}
          </span>
        </div>
      )}

      {meta.status === 'completed_local' && (
        <p className="text-sm text-muted-foreground">Saved locally — finishing sync…</p>
      )}

      <h1 className="text-2xl font-bold tracking-tight">Workout Summary</h1>

      <div className="space-y-1">
        <label htmlFor="workout-name" className="text-sm font-medium">
          Name
        </label>
        <Input
          id="workout-name"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setUserEdited(true);
          }}
          placeholder={autoName || 'Workout'}
          disabled={!isInProgress}
        />
      </div>

      <p className="text-sm text-muted-foreground">{dateStr}</p>

      <dl className="grid grid-cols-3 gap-4 text-center">
        <div className="space-y-1">
          <dt className="text-xs uppercase tracking-wide text-muted-foreground">Exercises</dt>
          <dd className="text-lg font-semibold">{exercises.length}</dd>
        </div>
        <div className="space-y-1">
          <dt className="text-xs uppercase tracking-wide text-muted-foreground">Sets</dt>
          <dd className="text-lg font-semibold">{totalSets}</dd>
        </div>
        <div className="space-y-1">
          <dt className="text-xs uppercase tracking-wide text-muted-foreground">Duration</dt>
          <dd className="text-lg font-semibold">{formatDuration(meta.startedAt, endIso)}</dd>
        </div>
      </dl>

      {exercises.length > 0 && (
        <div className="space-y-2">
          {exercises.map((ex) => {
            const exName = lookup.nameOf(ex.exerciseId) || 'Exercise';
            return (
              <div
                key={ex.localId}
                className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
              >
                <span className="font-medium">{exName}</span>
                <div className="flex gap-4 text-muted-foreground">
                  <span>{ex.sets.length === 1 ? '1 set' : `${ex.sets.length} sets`}</span>
                  <span>{formatVolume(ex.sets)}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="flex flex-col gap-3 pt-2">
        {isInProgress && (
          <>
            {/* eslint-disable-next-line jsx-a11y/no-autofocus */}
            <Button autoFocus onClick={handleSave}>
              Save
            </Button>
            <Button variant="ghost" onClick={onResume}>
              Resume Workout
            </Button>
          </>
        )}
        {isCompletedSynced && <Button onClick={clearCompletedSession}>Done</Button>}
      </div>
    </div>
  );
}
