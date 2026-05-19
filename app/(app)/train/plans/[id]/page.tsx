import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { PageContainer } from '@/components/page-container';
import { createSupabaseServerClient } from '@/lib/supabase/server-exports';
import { UUID_RE } from '@/lib/utils';
import { DeletePlanButton } from '@/features/plan/components/DeletePlanButton';
import { SharePlanButton } from '@/features/plan/components/SharePlanButton';
import { StartPlanWorkoutButton } from '@/features/plan/components/StartPlanWorkoutButton';

type PageExercise = {
  id: string;
  exercise_id: string;
  target_sets: number;
  target_reps: number;
  position: number;
  exercises: { name: string } | null;
};

type PageWorkout = {
  id: string;
  name: string;
  position: number;
  plan_exercises: PageExercise[];
};

export const metadata: Metadata = {
  title: 'Plan — LimenFit',
};

export default async function PlanDetailPage({ params }: { params: Promise<{ id: string }> }) {
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
      `id, name, updated_at, share_slug, is_public,
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

  if (planError) throw planError;
  if (!plan) {
    notFound();
  }

  const sortedWorkouts = [...(plan.plan_workouts as PageWorkout[])].sort(
    (a, b) => (a.position ?? 0) - (b.position ?? 0),
  );

  return (
    <PageContainer>
      <div className="mb-6 flex items-start justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">{plan.name}</h1>
        <div className="flex shrink-0 gap-2">
          <SharePlanButton
            planId={id}
            initialShareSlug={plan.share_slug}
            initialIsPublic={plan.is_public}
          />
          <Button asChild variant="outline" size="sm">
            <Link href={`/train/plans/${id}/edit`}>Edit</Link>
          </Button>
          <DeletePlanButton planId={id} />
        </div>
      </div>

      <div className="flex flex-col gap-4">
        {sortedWorkouts.map((workout) => {
          const sortedExercises = [...(workout.plan_exercises ?? [])].sort(
            (a, b) => (a.position ?? 0) - (b.position ?? 0),
          );

          const exercisesForButton = sortedExercises.map((e) => ({
            exerciseId: e.exercise_id,
            targetSets: e.target_sets,
            targetReps: e.target_reps,
          }));

          return (
            <div key={workout.id} className="rounded-lg border bg-card p-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h2 className="font-medium">{workout.name}</h2>
                <StartPlanWorkoutButton
                  planWorkoutId={workout.id}
                  planWorkoutName={workout.name}
                  exercises={exercisesForButton}
                />
              </div>
              {sortedExercises.length > 0 ? (
                <ul className="space-y-1">
                  {sortedExercises.map((ex) => (
                    <li key={ex.id} className="flex items-center justify-between text-sm">
                      <span>{ex.exercises?.name ?? ex.exercise_id}</span>
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
