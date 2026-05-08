'use client';

import * as React from 'react';

import { Button } from '@/components/ui/button';
import { useStartWorkoutAction } from '@/features/workout/hooks/useStartWorkoutAction';

interface Props {
  planWorkoutId: string;
  planWorkoutName: string;
  exercises: { exerciseId: string; targetSets: number; targetReps: number }[];
}

export function StartPlanWorkoutButton({ planWorkoutId, planWorkoutName, exercises }: Props) {
  const startWorkout = useStartWorkoutAction();
  const [isPending, setIsPending] = React.useState(false);

  async function handleClick() {
    setIsPending(true);
    try {
      await startWorkout({
        source: 'plan',
        payload: { planWorkoutId, planWorkoutName, exercises },
      });
    } finally {
      setIsPending(false);
    }
  }

  return (
    <Button size="sm" onClick={handleClick} disabled={isPending}>
      {isPending ? 'Starting…' : 'Start'}
    </Button>
  );
}
