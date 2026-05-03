'use client';

import * as React from 'react';

import { DiscardConfirmationDialog } from '@/components/discard-confirmation-dialog';

import { selectIsDirty } from '../store/selectors';
import { useActiveWorkoutStore } from '../store/useActiveWorkoutStore';
import { ActiveWorkoutHeader } from './ActiveWorkoutHeader';

type View = 'session' | 'summary';

export function ActiveWorkoutSession() {
  const [view, setView] = React.useState<View>('session');
  const [discardOpen, setDiscardOpen] = React.useState(false);

  const exercises = useActiveWorkoutStore((s) => s.exercises);

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

  return (
    <div className="flex min-h-dvh flex-col">
      <ActiveWorkoutHeader
        hasExercises={exercises.length > 0}
        onCancel={handleCancel}
        onEndWorkout={handleEndWorkout}
      />

      {view === 'session' && <div data-testid="active-workout-session" className="flex-1" />}
      {view === 'summary' && <div data-testid="end-workout-summary-view" className="flex-1" />}

      <DiscardConfirmationDialog
        open={discardOpen}
        onOpenChange={setDiscardOpen}
        title="Discard workout?"
        description="You'll lose any sets logged in this session."
        onDiscard={handleConfirmDiscard}
      />
    </div>
  );
}
