import { requireUser } from '@/lib/api/auth';
import { handleApiError, jsonCreated, jsonOk } from '@/lib/api/responses';
import { withIdempotency } from '@/lib/idempotency/server';
import { workoutCreateBodySchema } from '@/lib/schemas/workout';

export const runtime = 'nodejs';

type DraftMeta = {
  id: string;
  name: string | null;
  startedAt: string;
  lastActivityAt: string;
  planWorkoutId: string | null;
};

type CreateResponse = {
  id: string;
  clientMutationId: string;
  alreadyExisted: boolean;
  existingDraft: DraftMeta | null;
  name?: string | null;
  startedAt?: string;
  lastActivityAt?: string;
  planWorkoutId?: string | null;
};

type CreateResponseMetadata = {
  alreadyExisted: boolean;
};

export async function POST(request: Request): Promise<Response> {
  try {
    const { supabase, user } = await requireUser();
    const userId = user.id;

    const body = workoutCreateBodySchema.parse(await request.json());
    const { clientMutationId, name, planWorkoutId, startedAt, lastActivityAt } = body;

    const result = await withIdempotency<CreateResponse>({
      supabase,
      userId,
      clientMutationId,
      mutationType: 'workout.create',
      resourceType: 'workouts',
      handler: async (): Promise<{
        resourceId: string | null;
        response: CreateResponse;
        responseMetadata?: CreateResponseMetadata;
      }> => {
        // Return existing in-progress draft instead of creating a duplicate.
        const { data: existing, error: existingError } = await supabase
          .from('workouts')
          .select('id, name, started_at, last_activity_at, plan_workout_id')
          .eq('user_id', userId)
          .eq('status', 'in_progress')
          .maybeSingle();

        if (existingError) throw existingError;

        if (existing !== null) {
          return {
            resourceId: existing.id,
            response: {
              id: existing.id,
              clientMutationId,
              alreadyExisted: true,
              existingDraft: {
                id: existing.id,
                name: existing.name,
                startedAt: existing.started_at,
                lastActivityAt: existing.last_activity_at,
                planWorkoutId: existing.plan_workout_id,
              },
            },
            responseMetadata: { alreadyExisted: true },
          };
        }

        const { data: inserted, error: insertError } = await supabase
          .from('workouts')
          .insert({
            user_id: userId,
            name,
            plan_workout_id: planWorkoutId,
            started_at: startedAt,
            last_activity_at: lastActivityAt,
            status: 'in_progress',
          })
          .select('id, name, started_at, last_activity_at, plan_workout_id')
          .single();

        if (insertError) {
          // Race: another tab won the partial unique index between our SELECT and INSERT.
          // Fall back to the "existing draft" branch.
          if (insertError.code === '23505') {
            const { data: raceDraft, error: raceError } = await supabase
              .from('workouts')
              .select('id, name, started_at, last_activity_at, plan_workout_id')
              .eq('user_id', userId)
              .eq('status', 'in_progress')
              .maybeSingle();

            if (raceError) throw raceError;
            if (raceDraft === null) throw insertError;

            return {
              resourceId: raceDraft.id,
              response: {
                id: raceDraft.id,
                clientMutationId,
                alreadyExisted: true,
                existingDraft: {
                  id: raceDraft.id,
                  name: raceDraft.name,
                  startedAt: raceDraft.started_at,
                  lastActivityAt: raceDraft.last_activity_at,
                  planWorkoutId: raceDraft.plan_workout_id,
                },
              },
              responseMetadata: { alreadyExisted: true },
            };
          }
          throw insertError;
        }

        return {
          resourceId: inserted.id,
          response: {
            id: inserted.id,
            clientMutationId,
            alreadyExisted: false,
            existingDraft: null,
            name: inserted.name,
            startedAt: inserted.started_at,
            lastActivityAt: inserted.last_activity_at,
            planWorkoutId: inserted.plan_workout_id,
          },
          responseMetadata: { alreadyExisted: false },
        };
      },
    });

    if (result.replayed) {
      // Re-fetch so retries get a consistent response body with id + clientMutationId.
      const { data: w, error } = await supabase
        .from('workouts')
        .select('id, name, started_at, last_activity_at, plan_workout_id')
        .eq('id', result.resourceId!)
        .eq('user_id', userId)
        .maybeSingle();

      if (error) throw error;

      // Reconstruct the original response using stored metadata
      const alreadyExisted =
        (result.responseMetadata as CreateResponseMetadata | undefined)?.alreadyExisted ?? false;
      const existingDraft =
        alreadyExisted && w
          ? {
              id: w.id,
              name: w.name,
              startedAt: w.started_at,
              lastActivityAt: w.last_activity_at,
              planWorkoutId: w.plan_workout_id,
            }
          : null;

      if (alreadyExisted) {
        return jsonOk({
          id: result.resourceId!,
          clientMutationId,
          alreadyExisted: true,
          existingDraft,
        });
      }

      return jsonOk({
        id: result.resourceId!,
        clientMutationId,
        alreadyExisted: false,
        existingDraft: null,
        name: w?.name,
        startedAt: w?.started_at,
        lastActivityAt: w?.last_activity_at,
        planWorkoutId: w?.plan_workout_id,
      });
    }

    const { response } = result;
    return response!.alreadyExisted ? jsonOk(response!) : jsonCreated(response!);
  } catch (err) {
    return handleApiError(err);
  }
}
