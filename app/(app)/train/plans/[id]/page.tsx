import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { PageContainer } from '@/components/page-container';
import { createSupabaseServerClient } from '@/lib/supabase/server-exports';
import { UUID_RE } from '@/lib/utils';
import { DeletePlanButton } from '@/features/plan/components/DeletePlanButton';
import { StartPlanWorkoutButton } from '@/features/plan/components/StartPlanWorkoutButton';

export const metadata: Metadata = {
  title: 'Plan — LimenFit',
};

export default async function PlanDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  if (!UUID_RE.test(id)) {
    notFound();
  }

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: plan } = await supabase
    .from('plans')
    .select(
      `id, name, updated_at,
       plan_workouts (
         id, name, position,
         plan_exercises (
           id, exercise_id, target_sets, target_reps, position,
           exercises (name)
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

  return (
    <PageContainer>
      <div className="mb-6 flex items-start justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">{plan.name}</h1>
        <div className="flex shrink-0 gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href={`/train/plans/${id}/edit`}>Edit</Link>
          </Button>
          <DeletePlanButton planId={id} />
        </div>
      </div>

      <div className="flex flex-col gap-4">
        {sortedWorkouts.map((workout: any) => {
          const sortedExercises = [...((workout.plan_exercises ?? []) as any[])].sort(
            (a, b) => (a.position ?? 0) - (b.position ?? 0),
          );

          const exercisesForButton = sortedExercises.map((e: any) => ({
            exerciseId: e.exercise_id as string,
            targetSets: e.target_sets as number,
            targetReps: e.target_reps as number,
          }));

          return (
            <div key={workout.id} className="rounded-lg border bg-card p-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h2 className="font-medium">{workout.name}</h2>
                <StartPlanWorkoutButton
                  planWorkoutId={workout.id as string}
                  planWorkoutName={workout.name as string}
                  exercises={exercisesForButton}
                />
              </div>
              {sortedExercises.length > 0 ? (
                <ul className="space-y-1">
                  {sortedExercises.map((ex: any) => (
                    <li key={ex.id} className="flex items-center justify-between text-sm">
                      <span>
                        {(ex.exercises as { name: string } | null)?.name ?? ex.exercise_id}
                      </span>
                      <span className="text-muted-foreground">
                        Target: {ex.target_sets} × {ex.target_reps}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">No exercises added.</p>
              )}
            </div>
          );
        })}

        {sortedWorkouts.length === 0 && (
          <p className="py-4 text-center text-sm text-muted-foreground">
            No workouts in this plan yet.
          </p>
        )}
      </div>
    </PageContainer>
  );
}
