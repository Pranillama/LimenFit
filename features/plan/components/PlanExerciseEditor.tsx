'use client';

import * as React from 'react';

import { GripVertical, X } from 'lucide-react';
import { Reorder, useDragControls } from 'framer-motion';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useExerciseLookup } from '@/features/workout/hooks/useExerciseLookup';

import type { EditorExerciseItem } from '../lib/planEditorState';

interface PlanExerciseEditorProps {
  workoutLocalId: string;
  exercise: EditorExerciseItem;
  onTargetSetsChange: (workoutLocalId: string, exerciseLocalId: string, value: number) => void;
  onTargetRepsChange: (workoutLocalId: string, exerciseLocalId: string, value: number) => void;
  onRemove: (workoutLocalId: string, exerciseLocalId: string) => void;
}

export function PlanExerciseEditor({
  workoutLocalId,
  exercise,
  onTargetSetsChange,
  onTargetRepsChange,
  onRemove,
}: PlanExerciseEditorProps) {
  const controls = useDragControls();
  const { nameOf, isLoading } = useExerciseLookup();

  const reducedMotion =
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const setsInvalid = exercise.targetSets < 1 || exercise.targetSets > 50;
  const repsInvalid = exercise.targetReps < 0 || exercise.targetReps > 1000;

  return (
    <Reorder.Item
      as="div"
      value={exercise.localId}
      dragListener={false}
      dragControls={controls}
      transition={reducedMotion ? { duration: 0 } : undefined}
      className="flex items-center gap-2 rounded-md border bg-card px-2 py-2"
    >
      <button
        type="button"
        className="touch-none cursor-grab text-muted-foreground active:cursor-grabbing"
        onPointerDown={(e) => controls.start(e)}
        aria-label="Drag to reorder exercise"
      >
        <GripVertical className="h-4 w-4" />
      </button>

      <span className="min-w-0 flex-1 truncate text-sm">
        {isLoading ? (
          <span className="text-muted-foreground">Loading…</span>
        ) : (
          nameOf(exercise.exerciseId) || exercise.exerciseId
        )}
      </span>

      <div className="flex shrink-0 items-center gap-1">
        <div className="flex flex-col items-center gap-0.5">
          <label className="text-[10px] text-muted-foreground">Sets</label>
          <Input
            type="number"
            min={1}
            max={50}
            value={exercise.targetSets}
            onChange={(e) => {
              const v = parseInt(e.target.value, 10);
              if (!isNaN(v)) {
                onTargetSetsChange(workoutLocalId, exercise.localId, v);
              }
            }}
            className={cn(
              'h-7 w-14 text-center text-sm',
              setsInvalid && 'border-destructive focus-visible:ring-destructive',
            )}
            aria-invalid={setsInvalid}
            aria-label="Target sets"
          />
        </div>
        <span className="mt-3 text-muted-foreground">×</span>
        <div className="flex flex-col items-center gap-0.5">
          <label className="text-[10px] text-muted-foreground">Reps</label>
          <Input
            type="number"
            min={0}
            max={1000}
            value={exercise.targetReps}
            onChange={(e) => {
              const v = parseInt(e.target.value, 10);
              if (!isNaN(v)) {
                onTargetRepsChange(workoutLocalId, exercise.localId, v);
              }
            }}
            className={cn(
              'h-7 w-14 text-center text-sm',
              repsInvalid && 'border-destructive focus-visible:ring-destructive',
            )}
            aria-invalid={repsInvalid}
            aria-label="Target reps"
          />
        </div>
      </div>

      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-6 w-6 shrink-0 text-muted-foreground"
        onClick={() => onRemove(workoutLocalId, exercise.localId)}
        aria-label="Remove exercise"
      >
        <X className="h-3.5 w-3.5" />
      </Button>
    </Reorder.Item>
  );
}
