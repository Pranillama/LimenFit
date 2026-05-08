'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import { useRouter } from 'next/navigation';
import { Reorder } from 'framer-motion';
import { Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DiscardConfirmationDialog } from '@/components/discard-confirmation-dialog';

import type { EditorWorkoutItem } from '../lib/planEditorState';
import {
  addWorkout,
  removeWorkout,
  reorderWorkouts,
  updateWorkoutName,
  addExercisesToWorkout,
  removeExercise,
  reorderExercises,
  updateExerciseTargets,
  toApiWorkouts,
} from '../lib/planEditorState';
import { useCreatePlanMutation } from '../hooks/useCreatePlanMutation';
import { useUpdatePlanMutation } from '../hooks/useUpdatePlanMutation';
import { PlanWorkoutEditor } from './PlanWorkoutEditor';

// Editor-scoped schema mirroring API contracts without clientMutationId/position (positions are stored on items).
const editorExerciseSchema = z.object({
  localId: z.string(),
  id: z.string().optional(),
  exerciseId: z.string().uuid(),
  targetSets: z.number().int().min(1).max(50),
  targetReps: z.number().int().min(0).max(1000),
  position: z.number().int().min(0),
});

const editorWorkoutSchema = z.object({
  localId: z.string(),
  id: z.string().optional(),
  name: z.string().trim().min(1).max(100),
  position: z.number().int().min(0),
  exercises: z.array(editorExerciseSchema).min(1).max(50),
});

const planEditorFormSchema = z.object({
  name: z.string().trim().min(1).max(100),
  workouts: z.array(editorWorkoutSchema).min(1).max(20),
});

type PlanEditorFormValues = z.infer<typeof planEditorFormSchema>;

export interface InitialPlanState {
  id: string;
  name: string;
  workouts: EditorWorkoutItem[];
}

interface PlanEditorProps {
  mode: 'create' | 'edit';
  initialPlan?: InitialPlanState;
}

export function PlanEditor({ mode, initialPlan }: PlanEditorProps) {
  const router = useRouter();
  const createMutation = useCreatePlanMutation();
  const updateMutation = useUpdatePlanMutation();

  const {
    register,
    setValue,
    watch,
    trigger,
    handleSubmit: rhfHandleSubmit,
    formState,
  } = useForm<PlanEditorFormValues>({
    resolver: zodResolver(planEditorFormSchema),
    defaultValues: {
      name: initialPlan?.name ?? '',
      workouts: initialPlan?.workouts ?? [],
    },
    mode: 'onChange',
  });

  // Trigger initial validation so isValid reflects actual state on mount.
  React.useEffect(() => {
    void trigger();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const workouts = watch('workouts');

  const [localWorkoutIds, setLocalWorkoutIds] = React.useState(() =>
    (initialPlan?.workouts ?? []).map((w) => w.localId),
  );
  const [discardOpen, setDiscardOpen] = React.useState(false);

  // Keep localWorkoutIds in sync when workouts array changes (add/remove).
  React.useEffect(() => {
    const storeIds = workouts.map((w) => w.localId);
    const storeIdSet = new Set(storeIds);
    const surviving = localWorkoutIds.filter((id) => storeIdSet.has(id));
    const survivingSet = new Set(surviving);
    const added = storeIds.filter((id) => !survivingSet.has(id));
    const merged = [...surviving, ...added];
    const changed =
      merged.length !== localWorkoutIds.length || merged.some((id, i) => id !== localWorkoutIds[i]);
    if (changed) setLocalWorkoutIds(merged);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workouts]);

  const lastWorkoutIdsRef = React.useRef<string[]>(localWorkoutIds);

  function handleWorkoutReorder(newIds: string[]) {
    setLocalWorkoutIds(newIds);
    const changed =
      newIds.length !== lastWorkoutIdsRef.current.length ||
      newIds.some((id, i) => id !== lastWorkoutIdsRef.current[i]);
    if (changed) {
      lastWorkoutIdsRef.current = newIds;
      setValue('workouts', reorderWorkouts(workouts, newIds), {
        shouldDirty: true,
        shouldValidate: true,
      });
    }
  }

  function handleAddWorkout() {
    setValue('workouts', addWorkout(workouts), { shouldDirty: true, shouldValidate: true });
  }

  function handleRemoveWorkout(localId: string) {
    setValue('workouts', removeWorkout(workouts, localId), {
      shouldDirty: true,
      shouldValidate: true,
    });
  }

  function handleWorkoutNameChange(localId: string, newName: string) {
    setValue('workouts', updateWorkoutName(workouts, localId, newName), {
      shouldDirty: true,
      shouldValidate: true,
    });
  }

  function handleExercisesAdded(workoutLocalId: string, exerciseIds: string[]) {
    setValue('workouts', addExercisesToWorkout(workouts, workoutLocalId, exerciseIds), {
      shouldDirty: true,
      shouldValidate: true,
    });
  }

  function handleExerciseRemoved(workoutLocalId: string, exerciseLocalId: string) {
    setValue('workouts', removeExercise(workouts, workoutLocalId, exerciseLocalId), {
      shouldDirty: true,
      shouldValidate: true,
    });
  }

  function handleExercisesReordered(workoutLocalId: string, newLocalIds: string[]) {
    setValue('workouts', reorderExercises(workouts, workoutLocalId, newLocalIds), {
      shouldDirty: true,
      shouldValidate: true,
    });
  }

  function handleTargetSetsChange(
    workoutLocalId: string,
    exerciseLocalId: string,
    value: number,
  ) {
    setValue(
      'workouts',
      updateExerciseTargets(workouts, workoutLocalId, exerciseLocalId, { targetSets: value }),
      { shouldDirty: true, shouldValidate: true },
    );
  }

  function handleTargetRepsChange(
    workoutLocalId: string,
    exerciseLocalId: string,
    value: number,
  ) {
    setValue(
      'workouts',
      updateExerciseTargets(workouts, workoutLocalId, exerciseLocalId, { targetReps: value }),
      { shouldDirty: true, shouldValidate: true },
    );
  }

  function handleCancel() {
    if (formState.isDirty) {
      setDiscardOpen(true);
    } else {
      router.push('/train/plans');
    }
  }

  function handleDiscard() {
    setDiscardOpen(false);
    router.push('/train/plans');
  }

  const isPending = createMutation.isPending || updateMutation.isPending;

  async function handleSave(data: PlanEditorFormValues) {
    if (isPending) return;
    const apiWorkouts = toApiWorkouts(data.workouts);
    try {
      if (mode === 'create') {
        await createMutation.mutateAsync({ name: data.name, workouts: apiWorkouts });
      } else {
        await updateMutation.mutateAsync({
          id: initialPlan!.id,
          name: data.name,
          workouts: apiWorkouts,
        });
      }
    } catch {
      // error toast handled in mutation hook
    }
  }

  const byId = new Map(workouts.map((w) => [w.localId, w]));
  const orderedWorkouts = localWorkoutIds
    .map((id) => byId.get(id))
    .filter((w): w is EditorWorkoutItem => w !== undefined);

  return (
    <div className="flex min-h-screen flex-col">
      {/* Sticky header */}
      <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b bg-background px-4 py-3">
        <Button type="button" variant="ghost" size="sm" onClick={handleCancel}>
          Cancel
        </Button>
        <h1 className="text-base font-semibold">
          {mode === 'create' ? 'New Plan' : 'Edit Plan'}
        </h1>
        <Button
          type="button"
          size="sm"
          disabled={!formState.isValid || isPending}
          onClick={() => {
            void rhfHandleSubmit(handleSave)();
          }}
        >
          {isPending && <Loader2 className="animate-spin" />}
          Save Plan
        </Button>
      </div>

      <div className="flex flex-col gap-4 p-4">
        {/* Plan name */}
        <Input
          {...register('name')}
          placeholder="Plan name"
          className="text-base font-medium"
          aria-label="Plan name"
        />

        {/* Workouts */}
        {orderedWorkouts.length > 0 && (
          <Reorder.Group
            as="div"
            axis="y"
            values={localWorkoutIds}
            onReorder={handleWorkoutReorder}
            className="space-y-3"
          >
            {orderedWorkouts.map((workout) => (
              <PlanWorkoutEditor
                key={workout.localId}
                workout={workout}
                onNameChange={handleWorkoutNameChange}
                onRemove={handleRemoveWorkout}
                onExercisesAdded={handleExercisesAdded}
                onExerciseRemoved={handleExerciseRemoved}
                onExercisesReordered={handleExercisesReordered}
                onTargetSetsChange={handleTargetSetsChange}
                onTargetRepsChange={handleTargetRepsChange}
              />
            ))}
          </Reorder.Group>
        )}

        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={handleAddWorkout}
        >
          + Add Workout
        </Button>
      </div>

      <DiscardConfirmationDialog
        open={discardOpen}
        onOpenChange={setDiscardOpen}
        title="Discard plan?"
        description="Any unsaved changes will be lost."
        onDiscard={handleDiscard}
      />
    </div>
  );
}
