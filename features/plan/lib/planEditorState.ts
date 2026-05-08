import type { ImportedPlanWorkoutDraft } from '@/lib/plans/importFromHistory';
import type { PlanWorkoutDraft } from '@/lib/schemas/plan';

export type EditorExerciseItem = {
  localId: string;
  id?: string;
  exerciseId: string;
  targetSets: number;
  targetReps: number;
  position: number;
};

export type EditorWorkoutItem = {
  localId: string;
  id?: string;
  name: string;
  position: number;
  exercises: EditorExerciseItem[];
};

const DEFAULT_SETS = 3;
const DEFAULT_REPS = 10;

function withWorkoutPositions(workouts: EditorWorkoutItem[]): EditorWorkoutItem[] {
  return workouts.map((w, i) => ({ ...w, position: i }));
}

function withExercisePositions(exercises: EditorExerciseItem[]): EditorExerciseItem[] {
  return exercises.map((e, i) => ({ ...e, position: i }));
}

export function addWorkout(workouts: EditorWorkoutItem[]): EditorWorkoutItem[] {
  return withWorkoutPositions([
    ...workouts,
    { localId: crypto.randomUUID(), name: '', position: 0, exercises: [] },
  ]);
}

export function removeWorkout(
  workouts: EditorWorkoutItem[],
  localId: string,
): EditorWorkoutItem[] {
  return withWorkoutPositions(workouts.filter((w) => w.localId !== localId));
}

export function reorderWorkouts(
  workouts: EditorWorkoutItem[],
  newLocalIds: string[],
): EditorWorkoutItem[] {
  const byId = new Map(workouts.map((w) => [w.localId, w]));
  const reordered = newLocalIds
    .map((id) => byId.get(id))
    .filter((w): w is EditorWorkoutItem => w !== undefined);
  return withWorkoutPositions(reordered);
}

export function updateWorkoutName(
  workouts: EditorWorkoutItem[],
  workoutLocalId: string,
  name: string,
): EditorWorkoutItem[] {
  return workouts.map((w) => (w.localId === workoutLocalId ? { ...w, name } : w));
}

export function addExercisesToWorkout(
  workouts: EditorWorkoutItem[],
  workoutLocalId: string,
  exerciseIds: string[],
  defaults: { targetSets: number; targetReps: number } = {
    targetSets: DEFAULT_SETS,
    targetReps: DEFAULT_REPS,
  },
): EditorWorkoutItem[] {
  return workouts.map((w) => {
    if (w.localId !== workoutLocalId) return w;
    const newExercises: EditorExerciseItem[] = exerciseIds.map((exerciseId) => ({
      localId: crypto.randomUUID(),
      exerciseId,
      targetSets: defaults.targetSets,
      targetReps: defaults.targetReps,
      position: 0,
    }));
    return { ...w, exercises: withExercisePositions([...w.exercises, ...newExercises]) };
  });
}

export function removeExercise(
  workouts: EditorWorkoutItem[],
  workoutLocalId: string,
  exerciseLocalId: string,
): EditorWorkoutItem[] {
  return workouts.map((w) => {
    if (w.localId !== workoutLocalId) return w;
    return {
      ...w,
      exercises: withExercisePositions(w.exercises.filter((e) => e.localId !== exerciseLocalId)),
    };
  });
}

export function reorderExercises(
  workouts: EditorWorkoutItem[],
  workoutLocalId: string,
  newLocalIds: string[],
): EditorWorkoutItem[] {
  return workouts.map((w) => {
    if (w.localId !== workoutLocalId) return w;
    const byId = new Map(w.exercises.map((e) => [e.localId, e]));
    const reordered = newLocalIds
      .map((id) => byId.get(id))
      .filter((e): e is EditorExerciseItem => e !== undefined);
    return { ...w, exercises: withExercisePositions(reordered) };
  });
}

export function updateExerciseTargets(
  workouts: EditorWorkoutItem[],
  workoutLocalId: string,
  exerciseLocalId: string,
  updates: Partial<Pick<EditorExerciseItem, 'targetSets' | 'targetReps'>>,
): EditorWorkoutItem[] {
  return workouts.map((w) => {
    if (w.localId !== workoutLocalId) return w;
    return {
      ...w,
      exercises: w.exercises.map((e) =>
        e.localId === exerciseLocalId ? { ...e, ...updates } : e,
      ),
    };
  });
}

export function appendImportedWorkout(
  workouts: EditorWorkoutItem[],
  imported: ImportedPlanWorkoutDraft,
): EditorWorkoutItem[] {
  const newWorkout: EditorWorkoutItem = {
    localId: crypto.randomUUID(),
    name: imported.name,
    position: 0,
    exercises: withExercisePositions(
      imported.exercises.map((e) => ({
        localId: crypto.randomUUID(),
        exerciseId: e.exerciseId,
        targetSets: e.targetSets,
        targetReps: e.targetReps,
        position: 0,
      })),
    ),
  };
  return withWorkoutPositions([...workouts, newWorkout]);
}

export function toApiWorkouts(workouts: EditorWorkoutItem[]): PlanWorkoutDraft[] {
  return workouts.map((w) => ({
    name: w.name,
    position: w.position,
    exercises: w.exercises.map((e) => ({
      exerciseId: e.exerciseId,
      targetSets: e.targetSets,
      targetReps: e.targetReps,
      position: e.position,
    })),
  }));
}
