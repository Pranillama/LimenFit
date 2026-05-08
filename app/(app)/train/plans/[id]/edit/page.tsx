import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { createSupabaseServerClient } from '@/lib/supabase/server-exports';
import { UUID_RE } from '@/lib/utils';
import { PlanEditor } from '@/features/plan/components/PlanEditor';
import type { InitialPlanState } from '@/features/plan/components/PlanEditor';
import type { EditorExerciseItem, EditorWorkoutItem } from '@/features/plan/lib/planEditorState';

export const metadata: Metadata = {
  title: 'Edit Plan — LimenFit',
};

export default async function EditPlanPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  if (!UUID_RE.test(id)) {
    notFound();
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: plan } = await supabase
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

  if (!plan) {
    notFound();
  }

  const sortedWorkouts = [...((plan.plan_workouts ?? []) as any[])].sort(
    (a, b) => (a.position ?? 0) - (b.position ?? 0),
  );

  const initialPlan: InitialPlanState = {
    id: plan.id,
    name: plan.name,
    workouts: sortedWorkouts.map((w: any, wIdx: number): EditorWorkoutItem => {
      const sortedExercises = [...((w.plan_exercises ?? []) as any[])].sort(
        (a: any, b: any) => (a.position ?? 0) - (b.position ?? 0),
      );
      return {
        localId: crypto.randomUUID(),
        id: w.id as string,
        name: w.name as string,
        position: wIdx,
        exercises: sortedExercises.map((e: any, eIdx: number): EditorExerciseItem => ({
          localId: crypto.randomUUID(),
          id: e.id as string,
          exerciseId: e.exercise_id as string,
          targetSets: e.target_sets as number,
          targetReps: e.target_reps as number,
          position: eIdx,
        })),
      };
    }),
  };

  return <PlanEditor mode="edit" initialPlan={initialPlan} />;
}
