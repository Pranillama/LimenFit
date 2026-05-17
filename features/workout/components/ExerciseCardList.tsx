'use client';

import * as React from 'react';

import { Reorder, useDragControls } from 'framer-motion';

import type { ActiveWorkoutExercise } from '../store/types';
import { useActiveWorkoutStore } from '../store/useActiveWorkoutStore';
import { ExerciseCard } from './ExerciseCard';

interface ExerciseCardListProps {
  exercises: ActiveWorkoutExercise[];
  nameOf: (id: string) => string;
  isLookupLoading: boolean;
  onRemove: (localId: string) => void;
  now: number;
}

export function ExerciseCardList({
  exercises,
  nameOf,
  isLookupLoading,
  onRemove,
  now,
}: ExerciseCardListProps) {
  // Local ID ordering drives framer-motion animation; kept in sync with the store.
  const [localIds, setLocalIds] = React.useState(() => exercises.map((ex) => ex.localId));

  // When items are added or removed, rebuild the local order: preserve existing positions,
  // append new items at the end, drop tombstoned items.
  React.useEffect(() => {
    const storeIds = exercises.map((ex) => ex.localId);
    const storeIdSet = new Set(storeIds);
    const surviving = localIds.filter((id) => storeIdSet.has(id));
    const survivingSet = new Set(surviving);
    const added = storeIds.filter((id) => !survivingSet.has(id));
    const merged = [...surviving, ...added];

    const changed = merged.length !== localIds.length || merged.some((id, i) => id !== localIds[i]);
    if (changed) setLocalIds(merged);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exercises]);

  const reducedMotion =
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Ref tracks the last order we dispatched to the store so we never spam the queue.
  const lastDispatchedRef = React.useRef<string[]>(localIds);

  function handleReorder(newIds: string[]) {
    setLocalIds(newIds);
    const changed =
      newIds.length !== lastDispatchedRef.current.length ||
      newIds.some((id, i) => id !== lastDispatchedRef.current[i]);
    if (changed) {
      lastDispatchedRef.current = newIds;
      useActiveWorkoutStore.getState().reorderExercises(newIds);
    }
  }

  // Build the display list respecting local drag order.
  const byId = new Map(exercises.map((ex) => [ex.localId, ex]));
  const orderedExercises = localIds
    .map((id) => byId.get(id))
    .filter((ex): ex is ActiveWorkoutExercise => ex !== undefined);

  return (
    <Reorder.Group
      as="div"
      axis="y"
      values={localIds}
      onReorder={handleReorder}
      className="space-y-3"
    >
      {orderedExercises.map((exercise) => (
        <DraggableCard
          key={exercise.localId}
          exercise={exercise}
          nameOf={nameOf}
          isLookupLoading={isLookupLoading}
          onRemove={onRemove}
          now={now}
          reducedMotion={reducedMotion}
        />
      ))}
    </Reorder.Group>
  );
}

interface DraggableCardProps {
  exercise: ActiveWorkoutExercise;
  nameOf: (id: string) => string;
  isLookupLoading: boolean;
  onRemove: (localId: string) => void;
  now: number;
  reducedMotion: boolean;
}

function DraggableCard({
  exercise,
  nameOf,
  isLookupLoading,
  onRemove,
  now,
  reducedMotion,
}: DraggableCardProps) {
  const controls = useDragControls();

  return (
    <Reorder.Item
      as="div"
      value={exercise.localId}
      dragListener={false}
      dragControls={controls}
      transition={reducedMotion ? { duration: 0 } : undefined}
    >
      <ExerciseCard
        exercise={exercise}
        nameOf={nameOf}
        isLookupLoading={isLookupLoading}
        onRemove={onRemove}
        now={now}
        onDragHandlePointerDown={(e) => controls.start(e)}
      />
    </Reorder.Item>
  );
}
