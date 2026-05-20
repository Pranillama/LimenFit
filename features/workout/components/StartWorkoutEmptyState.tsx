'use client';

import * as React from 'react';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { ExercisePicker } from '@/features/exercise-picker';

import { useActiveWorkoutStore } from '../store/useActiveWorkoutStore';

interface Props {
  insightsPanel?: React.ReactNode;
}

export function StartWorkoutEmptyState({ insightsPanel }: Props) {
  const [pickerOpen, setPickerOpen] = React.useState(false);

  function handleConfirm(ids: string[]) {
    useActiveWorkoutStore.getState().startDraft({
      exercises: ids.map((id) => ({ exerciseId: id })),
    });
  }

  return (
    <>
      <div className="flex flex-col gap-6">
        <Button size="lg" onClick={() => setPickerOpen(true)}>
          Start Workout
        </Button>
        <ul className="flex flex-col gap-2 text-sm">
          <li>
            <Link href="/train/history" className="text-primary underline underline-offset-4">
              Workout History
            </Link>
          </li>
          <li>
            <Link href="/train/plans" className="text-primary underline underline-offset-4">
              My Plans
            </Link>
          </li>
        </ul>
      </div>

      {insightsPanel}

      <ExercisePicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        onConfirm={handleConfirm}
        title="Select Exercises"
      />
    </>
  );
}
