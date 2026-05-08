'use client';

import * as React from 'react';

import { GripVertical, X } from 'lucide-react';
import { Reorder, useDragControls } from 'framer-motion';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ExercisePicker } from '@/features/exercise-picker';

import type { EditorExerciseItem, EditorWorkoutItem } from '../lib/planEditorState';
import { PlanExerciseEditor } from './PlanExerciseEditor';

interface PlanWorkoutEditorProps {
  workout: EditorWorkoutItem;
  onNameChange: (workoutLocalId: string, name: string) => void;
  onRemove: (workoutLocalId: string) => void;
  onExercisesAdded: (workoutLocalId: string, exerciseIds: string[]) => void;
  onExerciseRemoved: (workoutLocalId: string, exerciseLocalId: string) => void;
  onExercisesReordered: (workoutLocalId: string, newLocalIds: string[]) => void;
  onTargetSetsChange: (workoutLocalId: string, exerciseLocalId: string, value: number) => void;
  onTargetRepsChange: (workoutLocalId: string, exerciseLocalId: string, value: number) => void;
  onImportFromHistory?: (workoutLocalId: string) => void;
}

export function PlanWorkoutEditor({
  workout,
  onNameChange,
  onRemove,
  onExercisesAdded,
  onExerciseRemoved,
  onExercisesReordered,
  onTargetSetsChange,
  onTargetRepsChange,
  onImportFromHistory,
}: PlanWorkoutEditorProps) {
  const dragControls = useDragControls();
  const [pickerOpen, setPickerOpen] = React.useState(false);

  // Local exercise IDs drive framer-motion animation; kept in sync with workout.exercises.
  const [localExerciseIds, setLocalExerciseIds] = React.useState(() =>
    workout.exercises.map((e) => e.localId),
  );

  React.useEffect(() => {
    const storeIds = workout.exercises.map((e) => e.localId);
    const storeIdSet = new Set(storeIds);
    const surviving = localExerciseIds.filter((id) => storeIdSet.has(id));
    const survivingSet = new Set(surviving);
    const added = storeIds.filter((id) => !survivingSet.has(id));
    const merged = [...surviving, ...added];
    const changed =
      merged.length !== localExerciseIds.length || merged.some((id, i) => id !== localExerciseIds[i]);
    if (changed) setLocalExerciseIds(merged);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workout.exercises]);

  const lastDispatchedRef = React.useRef<string[]>(localExerciseIds);

  function handleExerciseReorder(newIds: string[]) {
    setLocalExerciseIds(newIds);
    const changed =
      newIds.length !== lastDispatchedRef.current.length ||
      newIds.some((id, i) => id !== lastDispatchedRef.current[i]);
    if (changed) {
      lastDispatchedRef.current = newIds;
      onExercisesReordered(workout.localId, newIds);
    }
  }

  const byId = new Map(workout.exercises.map((e) => [e.localId, e]));
  const orderedExercises = localExerciseIds
    .map((id) => byId.get(id))
    .filter((e): e is EditorExerciseItem => e !== undefined);

  const reducedMotion =
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  return (
    <Reorder.Item
      as="div"
      value={workout.localId}
      dragListener={false}
      dragControls={dragControls}
      transition={reducedMotion ? { duration: 0 } : undefined}
      className="rounded-lg border bg-card"
    >
      {/* Workout header */}
      <div className="flex items-center gap-2 border-b px-3 py-2">
        <button
          type="button"
          className="touch-none cursor-grab text-muted-foreground active:cursor-grabbing"
          onPointerDown={(e) => dragControls.start(e)}
          aria-label="Drag to reorder workout"
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <Input
          placeholder="Workout name"
          value={workout.name}
          onChange={(e) => onNameChange(workout.localId, e.target.value)}
          className="h-8 flex-1 text-sm font-medium"
          aria-label="Workout name"
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0 text-muted-foreground"
          onClick={() => onRemove(workout.localId)}
          aria-label="Remove workout"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Exercise list */}
      <div className="px-3 py-2">
        {orderedExercises.length > 0 && (
          <Reorder.Group
            as="div"
            axis="y"
            values={localExerciseIds}
            onReorder={handleExerciseReorder}
            className="mb-2 space-y-2"
          >
            {orderedExercises.map((exercise) => (
              <PlanExerciseEditor
                key={exercise.localId}
                workoutLocalId={workout.localId}
                exercise={exercise}
                onTargetSetsChange={onTargetSetsChange}
                onTargetRepsChange={onTargetRepsChange}
                onRemove={onExerciseRemoved}
              />
            ))}
          </Reorder.Group>
        )}

        {/* Action buttons */}
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={() => setPickerOpen(true)}
          >
            + Add Exercises
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={() => onImportFromHistory?.(workout.localId)}
            disabled={!onImportFromHistory}
          >
            Import from History
          </Button>
        </div>
      </div>

      <ExercisePicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        title="Add Exercises"
        onConfirm={(ids) => {
          onExercisesAdded(workout.localId, ids);
          setPickerOpen(false);
        }}
      />
    </Reorder.Item>
  );
}
