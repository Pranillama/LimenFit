import type { SupabaseClient } from '@supabase/supabase-js';

import { requireUser } from '@/lib/api/auth';
import { handleApiError, jsonCreated, jsonOk } from '@/lib/api/responses';
import { withIdempotency } from '@/lib/idempotency/server';
import { planCreateBodySchema } from '@/lib/schemas/plan';
import type { Database } from '@/lib/supabase/types';

export const runtime = 'nodejs';

export type PlanExerciseRow = {
  id: string;
  exercise_id: string;
  target_sets: number;
  target_reps: number;
  position: number;
};

export type PlanWorkoutRow = {
  id: string;
  name: string;
  position: number;
  plan_exercises: PlanExerciseRow[];
};

export type PlanRow = {
  id: string;
  name: string;
  share_slug: string;
  is_public: boolean;
  created_at: string;
  updated_at: string;
  plan_workouts: PlanWorkoutRow[];
};

type PlanExerciseResponse = {
  id: string;
  exerciseId: string;
  targetSets: number;
  targetReps: number;
  position: number;
};

type PlanWorkoutResponse = {
  id: string;
  name: string;
  position: number;
  exercises: PlanExerciseResponse[];
};

export type PlanResponse = {
  id: string;
  clientMutationId: string;
  name: string;
  shareSlug: string;
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
  workouts: PlanWorkoutResponse[];
};

async function fetchPlanById(
  supabase: SupabaseClient<Database>,
  planId: string,
  userId: string,
): Promise<PlanRow | null> {
  const { data, error } = await supabase
    .from('plans')
    .select(
      `
      id, name, share_slug, is_public, created_at, updated_at,
      plan_workouts (
        id, name, position,
        plan_exercises (
          id, exercise_id, target_sets, target_reps, position
        )
      )
    `,
    )
    .eq('id', planId)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export function mapPlanToResponse(row: PlanRow, clientMutationId: string): PlanResponse {
  return {
    id: row.id,
    clientMutationId,
    name: row.name,
    shareSlug: row.share_slug,
    isPublic: row.is_public,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    workouts: [...row.plan_workouts]
      .sort((a, b) => a.position - b.position)
      .map((w) => ({
        id: w.id,
        name: w.name,
        position: w.position,
        exercises: [...w.plan_exercises]
          .sort((a, b) => a.position - b.position)
          .map((e) => ({
            id: e.id,
            exerciseId: e.exercise_id,
            targetSets: e.target_sets,
            targetReps: e.target_reps,
            position: e.position,
          })),
      })),
  };
}

export async function POST(request: Request): Promise<Response> {
  try {
    const { supabase, user } = await requireUser();
    const userId = user.id;

    const body = planCreateBodySchema.parse(await request.json());
    const { clientMutationId, name, workouts } = body;

    const result = await withIdempotency<PlanResponse>({
      supabase,
      userId,
      clientMutationId,
      mutationType: 'plan.create',
      resourceType: 'plans',
      handler: async () => {
        const p_workouts = workouts.map((w) => ({
          name: w.name,
          position: w.position,
          exercises: w.exercises.map((e) => ({
            exercise_id: e.exerciseId,
            target_sets: e.targetSets,
            target_reps: e.targetReps,
            position: e.position,
          })),
        }));

        const { data: rpcRows, error: rpcError } = await supabase.rpc('create_plan_with_children', {
          p_name: name,
          p_workouts,
          p_client_mutation_id: clientMutationId,
        });

        if (rpcError) {
          if (rpcError.code === '23505') {
            const { data: existing, error: selectError } = await supabase
              .from('plans')
              .select('id, share_slug')
              .eq('client_mutation_id', clientMutationId)
              .eq('user_id', userId)
              .maybeSingle();

            if (selectError) throw selectError;
            if (!existing) throw rpcError;

            const plan = await fetchPlanById(supabase, existing.id, userId);
            if (!plan) throw rpcError;

            return { resourceId: existing.id, response: mapPlanToResponse(plan, clientMutationId) };
          }
          throw rpcError;
        }

        const firstRow = (rpcRows as Array<{ plan_id: string }>)[0];
        if (!firstRow) throw new Error('create_plan_with_children returned no rows');
        const planId = firstRow.plan_id;
        const plan = await fetchPlanById(supabase, planId, userId);
        if (!plan) throw new Error('Plan not found after create');

        return { resourceId: planId, response: mapPlanToResponse(plan, clientMutationId) };
      },
    });

    if (result.replayed) {
      const plan = await fetchPlanById(supabase, result.resourceId!, userId);
      if (!plan) throw new Error('Plan not found on replay');
      return jsonOk(mapPlanToResponse(plan, clientMutationId));
    }

    return jsonCreated(result.response!);
  } catch (err) {
    return handleApiError(err);
  }
}
