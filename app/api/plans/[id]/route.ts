import { requireUser } from '@/lib/api/auth';
import { handleApiError, jsonError, jsonOk } from '@/lib/api/responses';
import { withIdempotency } from '@/lib/idempotency/server';
import { planDeleteBodySchema, planPatchBodySchema } from '@/lib/schemas/plan';
import { UUID_RE } from '@/lib/utils';

export const runtime = 'nodejs';

class RouteError extends Error {
  constructor(public readonly response: Response) {
    super('RouteError');
    this.name = 'RouteError';
  }
}

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

type PlanResponse = {
  id: string;
  clientMutationId: string;
  name: string;
  shareSlug: string;
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
  workouts: PlanWorkoutResponse[];
};

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

function mapPlanToResponse(row: any, clientMutationId: string): PlanResponse {
  return {
    id: row.id,
    clientMutationId,
    name: row.name,
    shareSlug: row.share_slug,
    isPublic: row.is_public,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    workouts: (row.plan_workouts as any[])
      .sort((a, b) => a.position - b.position)
      .map((w: any) => ({
        id: w.id,
        name: w.name,
        position: w.position,
        exercises: (w.plan_exercises as any[])
          .sort((a, b) => a.position - b.position)
          .map((e: any) => ({
            id: e.id,
            exerciseId: e.exercise_id,
            targetSets: e.target_sets,
            targetReps: e.target_reps,
            position: e.position,
          })),
      })),
  };
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const { supabase, user } = await requireUser();
    const userId = user.id;
    const { id } = await params;

    if (!UUID_RE.test(id)) {
      return jsonError(400, 'INVALID_ID', 'id must be a valid UUID');
    }

    const body = planPatchBodySchema.parse(await request.json());
    const { clientMutationId, name, workouts } = body;

    const result = await withIdempotency<PlanResponse>({
      supabase,
      userId,
      clientMutationId,
      mutationType: 'plan.patch',
      resourceType: 'plans',
      handler: async () => {
        if (workouts !== undefined) {
          let planName = name;
          if (planName === undefined) {
            const { data: current, error: currentError } = await supabase
              .from('plans')
              .select('name')
              .eq('id', id)
              .eq('user_id', userId)
              .maybeSingle();
            if (currentError) throw currentError;
            if (!current) throw new RouteError(jsonError(404, 'NOT_FOUND', 'Plan not found'));
            planName = current.name;
          }

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

          const { data: rows, error: rpcError } = await supabase.rpc(
            'update_plan_with_children',
            { p_plan_id: id, p_name: planName, p_workouts, p_client_mutation_id: clientMutationId },
          );
          if (rpcError) throw rpcError;
          if (!rows || (rows as any[]).length === 0) {
            throw new RouteError(jsonError(404, 'NOT_FOUND', 'Plan not found'));
          }
        } else {
          const { data: rows, error: updateError } = await supabase.rpc(
            'update_plan_name',
            { p_plan_id: id, p_name: name!, p_client_mutation_id: clientMutationId },
          );
          if (updateError) throw updateError;
          if (!rows || (rows as any[]).length === 0) {
            throw new RouteError(jsonError(404, 'NOT_FOUND', 'Plan not found'));
          }
        }

        const plan = await fetchPlanById(supabase, id, userId);
        if (!plan) throw new RouteError(jsonError(404, 'NOT_FOUND', 'Plan not found'));
        return { resourceId: id, response: mapPlanToResponse(plan, clientMutationId) };
      },
    });

    if (result.replayed) {
      const plan = await fetchPlanById(supabase, result.resourceId!, userId);
      if (!plan) throw new RouteError(jsonError(404, 'NOT_FOUND', 'Plan not found'));
      return jsonOk(mapPlanToResponse(plan, clientMutationId));
    }

    return jsonOk(result.response!);
  } catch (err) {
    if (err instanceof RouteError) return err.response;
    return handleApiError(err);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const { supabase, user } = await requireUser();
    const userId = user.id;
    const { id } = await params;

    if (!UUID_RE.test(id)) {
      return jsonError(400, 'INVALID_ID', 'id must be a valid UUID');
    }

    const body = planDeleteBodySchema.parse(await request.json());
    const { clientMutationId } = body;

    const result = await withIdempotency({
      supabase,
      userId,
      clientMutationId,
      mutationType: 'plan.discard',
      resourceType: 'plans',
      handler: async () => {
        const { error: deleteError } = await supabase
          .from('plans')
          .delete()
          .eq('id', id)
          .eq('user_id', userId);
        if (deleteError) throw deleteError;
        // Zero rows deleted (plan already gone) is idempotent success.
        return { resourceId: id, response: { id, clientMutationId } };
      },
    });

    if (result.replayed) {
      return jsonOk({ id, clientMutationId });
    }

    return jsonOk(result.response!);
  } catch (err) {
    if (err instanceof RouteError) return err.response;
    return handleApiError(err);
  }
}
