import type { SupabaseClient } from '@supabase/supabase-js';

import { assertServerOnly } from '@/lib/env';
import { newClientMutationId } from '@/lib/idempotency';
import type { Database } from '@/lib/supabase/types';

assertServerOnly();

export class PlanNotFoundError extends Error {
  constructor(planId: string) {
    super(`Plan not found: ${planId}`);
    this.name = 'PlanNotFoundError';
  }
}

export async function duplicatePlanForUser(
  supabase: SupabaseClient<Database>,
  args: { sourcePlanId: string; targetUserId: string },
): Promise<{ planId: string; shareSlug: string }> {
  const { data: plan, error: selectError } = await supabase
    .from('plans')
    .select('id, name, plan_workouts(id, name, position, plan_exercises(exercise_id, target_sets, target_reps, position))')
    .eq('id', args.sourcePlanId)
    .maybeSingle();

  if (selectError) throw new Error(selectError.message);
  if (!plan) throw new PlanNotFoundError(args.sourcePlanId);

  const pWorkouts = (plan.plan_workouts as Array<{
    id: string;
    name: string;
    position: number;
    plan_exercises: Array<{
      exercise_id: string;
      target_sets: number;
      target_reps: number;
      position: number;
    }>;
  }>).map((w) => ({
    name: w.name,
    position: w.position,
    exercises: w.plan_exercises.map((e) => ({
      exercise_id: e.exercise_id,
      target_sets: e.target_sets,
      target_reps: e.target_reps,
      position: e.position,
    })),
  }));

  const { data: rpcRows, error: rpcError } = await supabase.rpc('create_plan_with_children', {
    p_name: plan.name,
    p_workouts: pWorkouts,
    p_client_mutation_id: newClientMutationId(),
  });

  if (rpcError) throw new Error(rpcError.message);

  const row = (rpcRows as Array<{ plan_id: string; share_slug: string }>)[0];
  return { planId: row.plan_id, shareSlug: row.share_slug };
}
