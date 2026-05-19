import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { createSupabaseServerClient } from '@/lib/supabase/server-exports';
import { UUID_RE } from '@/lib/utils';
import { PlanEditor } from '@/features/plan/components/PlanEditor';
import type { InitialPlanState } from '@/features/plan/components/PlanEditor';
import type { EditorExerciseItem, EditorWorkoutItem } from '@/features/plan/lib/planEditorState';

type PageExercise = {
  id: string;
  exercise_id: string;
  target_sets: number;
  target_reps: number;
  position: number;
};

type PageWorkout = {
  id: string;
  name: string;
  position: number;
  plan_exercises: PageExercise[];
};

export const metadata: Metadata = {
  title: 'Edit Plan — LimenFit',
};

export default async function EditPlanPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  if (!UUID_RE.test(id)) {
    notFound();
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: plan, error: planError } = await supabase
    .from('plans')
    .select(
      `id, name,
       plan_workouts (
         id, name, position,
         plan_exercises (
           id, exercise_id, target_sets, target_reps, position
         )
       )`,
    )
    .eq('id', id)
    .eq('user_id', user!.id)
    .maybeSingle();

  if (planError) throw planError;
  if (!plan) {
    notFound();
  }

  const sortedWorkouts = [...(plan.plan_workouts as PageWorkout[])].sort(
    (a, b) => (a.position ?? 0) - (b.position ?? 0),
  );

  const initialPlan: InitialPlanState = {
    id: plan.id,
    name: plan.name,
    workouts: sortedWorkouts.map((w, wIdx): EditorWorkoutItem => {
      const sortedExercises = [...(w.plan_exercises ?? [])].sort(
        (a, b) => (a.position ?? 0) - (b.position ?? 0),
      );
      return {
        localId: crypto.randomUUID(),
        id: w.id,
        name: w.name,
        position: wIdx,
        exercises: sortedExercises.map(
          (e, eIdx): EditorExerciseItem => ({
            localId: crypto.randomUUID(),
            id: e.id,
            exerciseId: e.exercise_id,
            targetSets: e.target_sets,
            targetReps: e.target_reps,
            position: eIdx,
          }),
        ),
      };
    }),
  };

  return <PlanEditor mode="edit" initialPlan={initialPlan} />;
}
