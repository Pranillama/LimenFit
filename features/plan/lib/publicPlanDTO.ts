import { assertServerOnly } from '@/lib/env';
import { createSupabaseAnonClient } from '@/lib/supabase/server-exports';

assertServerOnly();

export interface PublicPlanExerciseDTO {
  id: string;
  exerciseName: string;
  targetSets: number;
  targetReps: number;
  position: number;
}

export interface PublicPlanWorkoutDTO {
  id: string;
  name: string;
  position: number;
  exercises: PublicPlanExerciseDTO[];
}

export interface PublicPlanDTO {
  id: string;
  name: string;
  shareSlug: string;
  updatedAt: string;
  workouts: PublicPlanWorkoutDTO[];
}

export async function fetchPublicPlanBySlug(
  shareSlug: string,
): Promise<PublicPlanDTO | null> {
  const supabase = createSupabaseAnonClient();

  const { data, error } = await supabase
    .from('plans')
    .select(
      `id, name, share_slug, updated_at,
       plan_workouts (
         id, name, position,
         plan_exercises (
           id, target_sets, target_reps, position,
           exercises (name)
         )
       )`,
    )
    .eq('share_slug', shareSlug)
    .eq('is_public', true)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const row = data as unknown as {
    id: string;
    name: string;
    share_slug: string;
    updated_at: string;
    plan_workouts: Array<{
      id: string;
      name: string;
      position: number;
      plan_exercises: Array<{
        id: string;
        target_sets: number;
        target_reps: number;
        position: number;
        exercises: { name: string } | null;
      }> | null;
    }> | null;
  };

  const workouts: PublicPlanWorkoutDTO[] = [...(row.plan_workouts ?? [])]
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
    .map((w) => ({
      id: w.id,
      name: w.name,
      position: w.position,
      exercises: [...(w.plan_exercises ?? [])]
        .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
        .map((e) => ({
          id: e.id,
          exerciseName: e.exercises?.name ?? 'Unknown exercise',
          targetSets: e.target_sets,
          targetReps: e.target_reps,
          position: e.position,
        })),
    }));

  return {
    id: row.id,
    name: row.name,
    shareSlug: row.share_slug,
    updatedAt: row.updated_at,
    workouts,
  };
}
