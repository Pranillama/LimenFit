import { requireUser } from '@/lib/api/auth';
import { handleApiError, jsonCreated, jsonError, jsonOk } from '@/lib/api/responses';
import { withIdempotency } from '@/lib/idempotency/server';
import { duplicatePlanForUser, PlanNotFoundError } from '@/lib/plans/duplicate';
import { mapPlanToResponse, type PlanResponse } from '@/app/api/plans/route';
import { planDuplicateBodySchema } from '@/lib/schemas/plan';

export const runtime = 'nodejs';

class RouteError extends Error {
  constructor(public readonly response: Response) {
    super('RouteError');
    this.name = 'RouteError';
  }
}

async function fetchPlanById(supabase: any, planId: string, userId: string) {
  const { data, error } = await supabase
    .from('plans')
    .select(`
      id, name, share_slug, is_public, created_at, updated_at,
      plan_workouts (
        id, name, position,
        plan_exercises (
          id, exercise_id, target_sets, target_reps, position
        )
      )
    `)
    .eq('id', planId)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function POST(request: Request): Promise<Response> {
  try {
    const { supabase, user } = await requireUser();
    const userId = user.id;

    const body = planDuplicateBodySchema.parse(await request.json());
    const { clientMutationId, sourceShareSlug } = body;

    const result = await withIdempotency<PlanResponse>({
      supabase,
      userId,
      clientMutationId,
      mutationType: 'plan.duplicate',
      resourceType: 'plans',
      handler: async () => {
        const { data: source, error: lookupError } = await supabase
          .from('plans')
          .select('id')
          .eq('share_slug', sourceShareSlug)
          .eq('is_public', true)
          .maybeSingle();
        if (lookupError) throw lookupError;
        if (!source) {
          throw new RouteError(jsonError(404, 'NOT_FOUND', 'Plan not found'));
        }

        let newPlanId: string;
        try {
          const dup = await duplicatePlanForUser(supabase, {
            sourcePlanId: source.id,
            targetUserId: userId,
            clientMutationId,
          });
          newPlanId = dup.planId;
        } catch (err) {
          if (err instanceof PlanNotFoundError) {
            throw new RouteError(jsonError(404, 'NOT_FOUND', 'Plan not found'));
          }
          throw err;
        }

        const plan = await fetchPlanById(supabase, newPlanId, userId);
        if (!plan) throw new Error('Plan not found after duplicate');

        return { resourceId: newPlanId, response: mapPlanToResponse(plan, clientMutationId) };
      },
    });

    if (result.replayed) {
      const plan = await fetchPlanById(supabase, result.resourceId!, userId);
      if (!plan) throw new RouteError(jsonError(404, 'NOT_FOUND', 'Plan not found'));
      return jsonOk(mapPlanToResponse(plan, clientMutationId));
    }

    return jsonCreated(result.response!);
  } catch (err) {
    if (err instanceof RouteError) return err.response;
    return handleApiError(err);
  }
}
