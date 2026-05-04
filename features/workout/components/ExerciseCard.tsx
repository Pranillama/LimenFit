'use client';

import * as React from 'react';

import { DiscardConfirmationDialog } from '@/components/discard-confirmation-dialog';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

import { useActiveWorkoutStore } from '../store/useActiveWorkoutStore';
import type { ActiveSet, ActiveWorkoutExercise, SetLogMutation } from '../store/types';
import { SetInputRow } from './SetInputRow';

interface ExerciseCardProps {
  exercise: ActiveWorkoutExercise;
  nameOf: (id: string) => string;
  isLookupLoading: boolean;
  onRemove: (localId: string) => void;
}

export function ExerciseCard({ exercise, nameOf, isLookupLoading, onRemove }: ExerciseCardProps) {
  const [deleteSetId, setDeleteSetId] = React.useState<string | null>(null);

  const pendingLocalIds = useActiveWorkoutStore(
    React.useCallback(
      (s) =>
        new Set(
          s.queue
            .filter((m): m is SetLogMutation => m.kind === 'set.log')
            .map((m) => m.payload.localId),
        ),
      [],
    ),
  );

  const name = nameOf(exercise.exerciseId);
  const lastSet = exercise.sets.at(-1);

  function handleConfirmDelete() {
    if (deleteSetId) {
      useActiveWorkoutStore.getState().deleteSet(deleteSetId);
      setDeleteSetId(null);
    }
  }

  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      {/* Header row */}
      <div className="flex items-center justify-between px-4 py-3">
        {isLookupLoading && !name ? (
          <Skeleton className="h-5 w-36" />
        ) : (
          <span className="font-medium">{name || <Skeleton className="inline-block h-5 w-36" />}</span>
        )}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => onRemove(exercise.localId)}
          aria-label={`Remove ${name || 'exercise'}`}
        >
          ✕
        </Button>
      </div>

      {/* Set table */}
      {exercise.sets.length > 0 && (
        <div className="border-t">
          <div className="grid grid-cols-[2.5rem_1fr_1fr_2.5rem_2rem] gap-x-2 px-4 py-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <span>Set</span>
            <span>Lbs</span>
            <span>Reps</span>
            <span className="text-center">✓</span>
            <span />
          </div>
          {exercise.sets.map((set) => (
            <SetRowDisplay
              key={set.localId}
              set={set}
              isPending={set.pending && pendingLocalIds.has(set.localId)}
              onDelete={() => setDeleteSetId(set.localId)}
            />
          ))}
        </div>
      )}

      {/* Input row */}
      <div className="border-t">
        <SetInputRow
          exerciseLocalId={exercise.localId}
          defaultWeight={lastSet?.weightValue ?? ''}
          defaultReps={lastSet?.reps ?? ''}
        />
      </div>

      <DiscardConfirmationDialog
        open={deleteSetId !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteSetId(null);
        }}
        title="Delete set?"
        description="This set will be removed."
        discardLabel="Delete"
        onDiscard={handleConfirmDelete}
      />
    </div>
  );
}

interface SetRowDisplayProps {
  set: ActiveSet;
  isPending: boolean;
  onDelete: () => void;
}

function SetRowDisplay({ set, isPending, onDelete }: SetRowDisplayProps) {
  return (
    <div className="grid grid-cols-[2.5rem_1fr_1fr_2.5rem_2rem] gap-x-2 px-4 py-1.5 text-sm">
      <span className="text-muted-foreground">{set.setNumber}</span>
      <span>{set.weightValue}</span>
      <span>{set.reps}</span>
      <span className="flex items-center justify-center">
        {isPending ? (
          <span
            className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-primary border-t-transparent"
            aria-label="Syncing"
          />
        ) : (
          <span className="text-green-600" aria-label="Logged">
            ✓
          </span>
        )}
      </span>
      <Button
        type="button"
        variant="ghost"
        className="h-6 w-6 p-0 text-xs text-muted-foreground"
        onClick={onDelete}
        aria-label="Delete set"
      >
        ✕
      </Button>
    </div>
  );
}
