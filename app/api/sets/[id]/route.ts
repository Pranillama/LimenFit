import { requireUser } from '@/lib/api/auth';
import { touchWorkoutLastActivity } from '@/lib/api/touchWorkout';
import { handleApiError, jsonError, jsonOk } from '@/lib/api/responses';
import { withIdempotency } from '@/lib/idempotency/server';
import { setDeleteBodySchema, setEditBodySchema } from '@/lib/schemas/set';

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

    const body = setEditBodySchema.parse(await request.json());
    const { clientMutationId, reps, weightValue, weightUnit } = body;

    const result = await withIdempotency({
      supabase,
      userId,
      clientMutationId,
      mutationType: 'set.edit',
      resourceType: 'sets',
      handler: async () => {
        // Two-level join: sets → workout_exercises → workouts.
        // RLS on workouts scopes to the calling user; !inner propagates the ownership
        // filter so the set row is absent if any link in the chain misses.
        const { data: set, error: setError } = await supabase
          .from('sets')
          .select('id, workout_exercises!inner(workout_id)')
          .eq('id', id)
          .maybeSingle();

        if (setError) throw setError;
        if (set === null) {
          throw new RouteError(jsonError(404, 'NOT_FOUND', 'Set not found'));
        }

        const { workout_id: workoutId } = set.workout_exercises as unknown as { workout_id: string };

        // Edits are allowed regardless of workout status — Flow 6 (inline editing) permits
        // modifying sets in completed workouts without re-opening them.
        const { error: updateError } = await supabase
          .from('sets')
          .update({
            ...(reps !== undefined && { reps }),
            ...(weightValue !== undefined && { weight_value: weightValue }),
            ...(weightUnit !== undefined && { weight_unit: weightUnit }),
          })
          .eq('id', id);
        if (updateError) throw updateError;

        await touchWorkoutLastActivity(supabase, workoutId, new Date().toISOString());

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

    const body = setDeleteBodySchema.parse(await request.json());
    const { clientMutationId } = body;

    const result = await withIdempotency({
      supabase,
      userId,
      clientMutationId,
      mutationType: 'set.delete',
      resourceType: 'sets',
      handler: async () => {
        const { data: set, error: setError } = await supabase
          .from('sets')
          .select('id, workout_exercises!inner(workout_id)')
          .eq('id', id)
          .maybeSingle();

        if (setError) throw setError;

        // Set already gone (deleted or cascaded) — idempotent: return success without touching.
        if (set === null) {
          return { resourceId: id, response: { id, clientMutationId } };
        }

        const { workout_id: workoutId } = set.workout_exercises as unknown as { workout_id: string };

        const { error: deleteError } = await supabase.from('sets').delete().eq('id', id);
        if (deleteError) throw deleteError;

        await touchWorkoutLastActivity(supabase, workoutId, new Date().toISOString());

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
