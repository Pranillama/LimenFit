import { requireUser } from '@/lib/api/auth';
import { touchWorkoutLastActivity } from '@/lib/api/touchWorkout';
import { handleApiError, jsonError, jsonOk } from '@/lib/api/responses';
import { withIdempotency } from '@/lib/idempotency/server';
import {
  workoutExerciseDeleteBodySchema,
  workoutExerciseReorderBodySchema,
} from '@/lib/schemas/workout-exercise';
import type { Database } from '@/lib/supabase/types';

type ReorderRow = Database['public']['Functions']['reorder_workout_exercise']['Returns'][number];
type DeleteRow =
  Database['public']['Functions']['delete_workout_exercise_in_progress']['Returns'][number];

export const runtime = 'nodejs';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

class RouteError extends Error {
  constructor(public readonly response: Response) {
    super('RouteError');
    this.name = 'RouteError';
  }
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

    const body = workoutExerciseReorderBodySchema.parse(await request.json());
    const { clientMutationId, position } = body;

    const result = await withIdempotency({
      supabase,
      userId,
      clientMutationId,
      mutationType: 'workoutExercise.reorder',
      resourceType: 'workout_exercises',
      handler: async () => {
        // Single atomic UPDATE constrained to an in_progress parent workout.
        // Returns 0 rows when the exercise is missing, belongs to another user,
        // or the parent workout is completed/expired — all map to 404.
        const { data: rows, error: rpcError } = await supabase.rpc('reorder_workout_exercise', {
          p_workout_exercise_id: id,
          p_position: position,
        });

        if (rpcError) throw rpcError;

        const updated = (rows as ReorderRow[] | null)?.[0];
        if (!updated) {
          throw new RouteError(jsonError(404, 'NOT_FOUND', 'Workout exercise not found'));
        }

        await touchWorkoutLastActivity(supabase, updated.workout_id, new Date().toISOString());

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

    const body = workoutExerciseDeleteBodySchema.parse(await request.json());
    const { clientMutationId } = body;

    const result = await withIdempotency({
      supabase,
      userId,
      clientMutationId,
      mutationType: 'workoutExercise.remove',
      resourceType: 'workout_exercises',
      handler: async () => {
        // Resolve the parent workout status and delete atomically.
        // The RPC returns a typed result discriminated by (deleted, workout_id):
        //   deleted=false, workout_id=null  → row not found   → idempotent 200
        //   deleted=false, workout_id=<id>  → parent not in_progress → 422
        //   deleted=true,  workout_id=<id>  → deleted          → touch + 200
        const { data: rows, error: rpcError } = await supabase.rpc(
          'delete_workout_exercise_in_progress',
          { p_workout_exercise_id: id },
        );

        if (rpcError) throw rpcError;

        const row = (rows as DeleteRow[] | null)?.[0];

        if (!row || (!row.deleted && row.workout_id === null)) {
          return { resourceId: id, response: { id, clientMutationId } };
        }

        if (!row.deleted) {
          throw new RouteError(
            jsonError(
              422,
              'WORKOUT_NOT_IN_PROGRESS',
              'Cannot delete exercises from a completed or expired workout',
            ),
          );
        }

        await touchWorkoutLastActivity(supabase, row.workout_id!, new Date().toISOString());

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
