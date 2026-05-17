'use client';

import * as React from 'react';

import { DiscardConfirmationDialog } from '@/components/discard-confirmation-dialog';
import { Button } from '@/components/ui/button';
import { ExercisePicker } from '@/features/exercise-picker';

import { useExerciseLookup } from '../hooks/useExerciseLookup';
import { useNow } from '../hooks/useNow';
import { selectIsDirty } from '../store/selectors';
import { useActiveWorkoutStore } from '../store/useActiveWorkoutStore';
import { ActiveWorkoutHeader } from './ActiveWorkoutHeader';
import { EndWorkoutSummary } from './EndWorkoutSummary';
import { ExerciseCardList } from './ExerciseCardList';

type View = 'session' | 'summary';

export function ActiveWorkoutSession() {
  const [view, setView] = React.useState<View>('session');
  const [discardOpen, setDiscardOpen] = React.useState(false);
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const [removeLocalId, setRemoveLocalId] = React.useState<string | null>(null);

  const exercises = useActiveWorkoutStore((s) => s.exercises);
  const lookup = useExerciseLookup();
  const now = useNow();

  function handleCancel() {
    const isDirty = selectIsDirty(useActiveWorkoutStore.getState());
    if (!isDirty) {
      useActiveWorkoutStore.getState().discardDraft();
    } else {
      setDiscardOpen(true);
    }
  }

  function handleEndWorkout() {
    setView('summary');
  }

  function handleConfirmDiscard() {
    useActiveWorkoutStore.getState().discardDraft();
  }

  function handleAddExercises(ids: string[]) {
    const existingIds = new Set(
      useActiveWorkoutStore.getState().exercises.map((ex) => ex.exerciseId),
    );
    const filtered = ids.filter((id) => !existingIds.has(id));
    if (filtered.length > 0) {
      useActiveWorkoutStore.getState().addExercises(filtered);
    }
  }

  function handleRemoveRequest(localId: string) {
    setRemoveLocalId(localId);
  }

  function handleConfirmRemove() {
    if (removeLocalId) {
      useActiveWorkoutStore.getState().removeExercise(removeLocalId);
      setRemoveLocalId(null);
    }
  }

  return (
    <div className="flex min-h-dvh flex-col">
      {view === 'session' && (
        <>
          <ActiveWorkoutHeader
            hasExercises={exercises.length > 0}
            now={now}
            onCancel={handleCancel}
            onEndWorkout={handleEndWorkout}
          />
          <div data-testid="active-workout-session" className="flex-1 px-4 py-4">
            <ExerciseCardList
              exercises={exercises}
              nameOf={lookup.nameOf}
              isLookupLoading={lookup.isLoading}
              onRemove={handleRemoveRequest}
              now={now}
            />
            <Button
              type="button"
              variant="outline"
              className="mt-3 w-full"
              onClick={() => setPickerOpen(true)}
            >
              + Add Exercise
            </Button>
          </div>
        </>
      )}

      {view === 'summary' && (
        <div className="flex-1 overflow-y-auto">
          <EndWorkoutSummary onResume={() => setView('session')} />
        </div>
      )}

      <DiscardConfirmationDialog
        open={discardOpen}
        onOpenChange={setDiscardOpen}
        title="Discard workout?"
        description="You'll lose any sets logged in this session."
        onDiscard={handleConfirmDiscard}
      />

      <DiscardConfirmationDialog
        open={removeLocalId !== null}
        onOpenChange={(open) => {
          if (!open) setRemoveLocalId(null);
        }}
        title="Remove exercise?"
        description="All sets logged for this exercise will be discarded."
        discardLabel="Remove"
        onDiscard={handleConfirmRemove}
      />

      <ExercisePicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        onConfirm={handleAddExercises}
        title="Add Exercises"
      />
    </div>
  );
}
