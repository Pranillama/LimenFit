import { requireUser } from '@/lib/api/auth';
import { handleApiError, jsonError, jsonOk } from '@/lib/api/responses';
import { withIdempotency } from '@/lib/idempotency/server';
import { workoutRestoreBodySchema } from '@/lib/schemas/workout';

export const runtime = 'nodejs';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

class RouteError extends Error {
  constructor(public readonly response: Response) {
    super('RouteError');
    this.name = 'RouteError';
  }
}

type DraftRow = {
  id: string;
  name: string | null;
  started_at: string;
  last_activity_at: string;
  plan_workout_id: string | null;
};

function mapDraftFields(w: DraftRow) {
  return {
    id: w.id,
    name: w.name,
    startedAt: w.started_at,
    lastActivityAt: w.last_activity_at,
    planWorkoutId: w.plan_workout_id,
  };
}

// Returns the ACTIVE_DRAFT_EXISTS 422 response.
// Uses 422 (not 409) so the offline queue quarantines this mutation rather than
// treating it as a retriable conflict — the caller must finish or discard their
// active draft first, which requires user action.
function activeDraftExistsResponse(draft: DraftRow | null): Response {
  return jsonError(
    422,
    'ACTIVE_DRAFT_EXISTS',
    'Finish or discard your current active workout before restoring this one.',
    { activeDraft: draft ? mapDraftFields(draft) : null },
  );
}

export async function POST(
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

    const body = workoutRestoreBodySchema.parse(await request.json());
    const { clientMutationId } = body;

    const result = await withIdempotency({
      supabase,
      userId,
      clientMutationId,
      mutationType: 'workout.restore',
      resourceType: 'workouts',
      handler: async () => {
        // Assert target is expired.
        const { data: target, error: fetchError } = await supabase
          .from('workouts')
          .select('id, name, status, started_at, last_activity_at, plan_workout_id')
          .eq('id', id)
          .eq('user_id', userId)
          .maybeSingle();

        if (fetchError) throw fetchError;
        if (target === null) {
          throw new RouteError(jsonError(404, 'NOT_FOUND', 'Workout not found'));
        }
        if (target.status !== 'expired') {
          throw new RouteError(
            jsonError(422, 'NOT_EXPIRED', 'Only expired workouts can be restored'),
          );
        }

        // Pre-check: reject if an active draft already exists.
        const { data: activeDraft, error: activeError } = await supabase
          .from('workouts')
          .select('id, name, started_at, last_activity_at, plan_workout_id')
          .eq('user_id', userId)
          .eq('status', 'in_progress')
          .maybeSingle();

        if (activeError) throw activeError;
        if (activeDraft !== null) {
          throw new RouteError(activeDraftExistsResponse(activeDraft));
        }

        // Flip status back to in_progress. The AND status = 'expired' guard prevents
        // a double-restore from touching a row that was already changed by a concurrent request.
        const { data: restored, error: updateError } = await supabase
          .from('workouts')
          .update({
            status: 'in_progress',
            expired_at: null,
            last_activity_at: new Date().toISOString(),
          })
          .eq('id', id)
          .eq('user_id', userId)
          .eq('status', 'expired')
          .select('id, name, started_at, last_activity_at, plan_workout_id')
          .maybeSingle();

        if (updateError) {
          if (updateError.code === '23505') {
            // Race: another draft became in_progress between our pre-check and UPDATE.
            const { data: raceDraft, error: raceDraftError } = await supabase
              .from('workouts')
              .select('id, name, started_at, last_activity_at, plan_workout_id')
              .eq('user_id', userId)
              .eq('status', 'in_progress')
              .maybeSingle();
            if (raceDraftError) throw raceDraftError;
            if (raceDraft === null) throw updateError;
            throw new RouteError(activeDraftExistsResponse(raceDraft));
          }
          throw updateError;
        }

        if (restored === null) {
          // The target row's status changed between our assertion and the UPDATE
          // (e.g., deleted externally). Return 404 rather than a stale 422.
          throw new RouteError(
            jsonError(404, 'NOT_FOUND', 'Workout not found or no longer expired'),
          );
        }

        return {
          resourceId: id,
          response: {
            id: restored.id,
            clientMutationId,
            workout: mapDraftFields(restored),
          },
        };
      },
    });

    if (result.replayed) {
      // Re-fetch the restored workout to give the client current field values.
      const { data: w, error } = await supabase
        .from('workouts')
        .select('id, name, started_at, last_activity_at, plan_workout_id')
        .eq('id', result.resourceId!)
        .eq('user_id', userId)
        .maybeSingle();

      if (error) throw error;

      return jsonOk({
        id,
        clientMutationId,
        workout: w ? mapDraftFields(w) : null,
      });
    }

    return jsonOk(result.response!);
  } catch (err) {
    if (err instanceof RouteError) return err.response;
    return handleApiError(err);
  }
}
