'use client';

import { useMemo } from 'react';
import { useExercisesQuery } from '@/features/exercise-picker/index';
import type { ExerciseListItem } from '@/features/exercise-picker/index';

export interface ExerciseLookup {
  map: Map<string, ExerciseListItem>;
  nameOf: (id: string) => string;
  isLoading: boolean;
}

/**
 * Wraps useExercisesQuery and returns a memoised id→ExerciseListItem map
 * plus a nameOf helper. Mount once near the workout session root so all card
 * components share the same query result without each re-running the query.
 */
export function useExerciseLookup(): ExerciseLookup {
  const { data = [], isLoading } = useExercisesQuery();

  const map = useMemo<Map<string, ExerciseListItem>>(
    () => new Map(data.map((ex) => [ex.id, ex])),
    [data],
  );

  const nameOf = useMemo(() => (id: string) => map.get(id)?.name ?? '', [map]);

  return { map, nameOf, isLoading };
}
