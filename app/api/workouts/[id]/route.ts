import { revalidateTag } from 'next/cache';

import { requireUser } from '@/lib/api/auth';
import { handleApiError, jsonError, jsonOk } from '@/lib/api/responses';
import { withIdempotency } from '@/lib/idempotency/server';
import { insightsTag } from '@/lib/insights';
import { workoutDiscardBodySchema, workoutPatchBodySchema } from '@/lib/schemas/workout';
import type { Database } from '@/lib/supabase/types';
import { UUID_RE } from '@/lib/utils';

type WorkoutUpdate = Database['public']['Tables']['workouts']['Update'];

export const runtime = 'nodejs';

// Carry an HTTP response through the withIdempotency handler boundary
// without triggering handleApiError's 500 fallback.
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

    const body = workoutPatchBodySchema.parse(await request.json());
    const { clientMutationId, name, status, lastActivityAt } = body;
    // Note: workoutPatchBodySchema already excludes 'expired' from the status enum,
    // so a client sending status='expired' receives a 400 VALIDATION_ERROR from Zod.

    const result = await withIdempotency({
      supabase,
      userId,
      clientMutationId,
      mutationType: 'workout.patch',
      resourceType: 'workouts',
      handler: async () => {
        const now = new Date().toISOString();
        const patch: WorkoutUpdate = {
          last_activity_at: lastActivityAt ?? now,
        };

        if (name !== undefined) patch.name = name;
        if (status !== undefined) patch.status = status;

        // Status gate is part of the mutation: constrain UPDATE to non-expired rows so a
        // cron expiration landing between a pre-check and the actual write cannot be patched.
        const { data: updated, error: updateError } = await supabase
          .from('workouts')
          .update(patch)
          .eq('id', id)
          .eq('user_id', userId)
          .neq('status', 'expired')
          .select('id')
          .maybeSingle();

        if (updateError) throw updateError;

        if (updated === null) {
          // Zero rows: either the workout does not exist or it is expired.
          // Re-fetch to distinguish 404 from 422.
          const { data: current, error: refetchError } = await supabase
            .from('workouts')
            .select('status')
            .eq('id', id)
            .eq('user_id', userId)
            .maybeSingle();

          if (refetchError) throw refetchError;
          if (current === null) {
            throw new RouteError(jsonError(404, 'NOT_FOUND', 'Workout not found'));
          }
          throw new RouteError(
            jsonError(422, 'WORKOUT_EXPIRED', 'Cannot update an expired workout'),
          );
        }

        // Database-side COALESCE for completed_at: constrain to status='completed' AND
        // completed_at IS NULL so only the first completion request sets the timestamp.
        // The status guard ensures a concurrent status change between the two queries cannot
        // leave completed_at populated on a row that is no longer completed.
        if (status === 'completed') {
          const { data: flipped, error: completedAtError } = await supabase
            .from('workouts')
            .update({ completed_at: now })
            .eq('id', id)
            .eq('user_id', userId)
            .eq('status', 'completed')
            .is('completed_at', null)
            .select('id');

          if (completedAtError) throw completedAtError;

          // Only invalidate on the first real completion — if completed_at was already
          // set the WHERE clause matches nothing and flipped is empty.
          if (flipped && flipped.length > 0) {
            try {
              revalidateTag(insightsTag(userId));
            } catch (err) {
              console.error('[insights] revalidateTag failed — cache may be stale:', err);
            }
          }
        }

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

    const body = workoutDiscardBodySchema.parse(await request.json());
    const { clientMutationId } = body;

    const result = await withIdempotency({
      supabase,
      userId,
      clientMutationId,
      mutationType: 'workout.discard',
      resourceType: 'workouts',
      handler: async () => {
        // Status gate is part of the mutation: all three lifecycle statuses are deletable.
        // ON DELETE CASCADE handles workout_exercises and sets cleanup.
        const { data: deleted, error: deleteError } = await supabase
          .from('workouts')
          .delete()
          .eq('id', id)
          .eq('user_id', userId)
          .in('status', ['in_progress', 'expired', 'completed'])
          .select('id');

        if (deleteError) throw deleteError;

        if (deleted.length === 0) {
          // Zero rows deleted: row is already gone — idempotent success.
          return { resourceId: id, response: { id, clientMutationId } };
        }

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
