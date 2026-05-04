'use client';

import * as React from 'react';

import { DiscardConfirmationDialog } from '@/components/discard-confirmation-dialog';
import { Button } from '@/components/ui/button';
import { ExercisePicker } from '@/features/exercise-picker';

import { useExerciseLookup } from '../hooks/useExerciseLookup';
import { selectIsDirty } from '../store/selectors';
import { useActiveWorkoutStore } from '../store/useActiveWorkoutStore';
import { ActiveWorkoutHeader } from './ActiveWorkoutHeader';
import { ExerciseCard } from './ExerciseCard';

type View = 'session' | 'summary';

export function ActiveWorkoutSession() {
  const [view, setView] = React.useState<View>('session');
  const [discardOpen, setDiscardOpen] = React.useState(false);
  const [pickerOpen, setPickerOpen] = React.useState(false);

  const exercises = useActiveWorkoutStore((s) => s.exercises);
  const lookup = useExerciseLookup();

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
    if (ids.length > 0) {
      useActiveWorkoutStore.getState().addExercises(ids);
    }
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <ActiveWorkoutHeader
        hasExercises={exercises.length > 0}
        onCancel={handleCancel}
        onEndWorkout={handleEndWorkout}
      />

      {view === 'session' && (
        <div data-testid="active-workout-session" className="flex-1 space-y-3 px-4 py-4">
          {exercises.map((exercise) => (
            <ExerciseCard
              key={exercise.localId}
              exercise={exercise}
              nameOf={lookup.nameOf}
              isLookupLoading={lookup.isLoading}
              onRemove={() => {}}
            />
          ))}
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => setPickerOpen(true)}
          >
            + Add Exercise
          </Button>
        </div>
      )}

      {view === 'summary' && <div data-testid="end-workout-summary-view" className="flex-1" />}

      <DiscardConfirmationDialog
        open={discardOpen}
        onOpenChange={setDiscardOpen}
        title="Discard workout?"
        description="You'll lose any sets logged in this session."
        onDiscard={handleConfirmDiscard}
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
