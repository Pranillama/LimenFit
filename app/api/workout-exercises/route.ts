import { requireUser } from '@/lib/api/auth';
import { touchWorkoutLastActivity } from '@/lib/api/touchWorkout';
import { handleApiError, jsonCreated, jsonError, jsonOk } from '@/lib/api/responses';
import { withIdempotency } from '@/lib/idempotency/server';
import { workoutExerciseAddBodySchema } from '@/lib/schemas/workout-exercise';

export const runtime = 'nodejs';

class RouteError extends Error {
  constructor(public readonly response: Response) {
    super('RouteError');
    this.name = 'RouteError';
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    const { supabase, user } = await requireUser();
    const userId = user.id;

    const body = workoutExerciseAddBodySchema.parse(await request.json());
    const { clientMutationId, workoutId, exerciseId, position } = body;

    const result = await withIdempotency({
      supabase,
      userId,
      clientMutationId,
      mutationType: 'workoutExercise.add',
      resourceType: 'workout_exercises',
      handler: async () => {
        const { data: workout, error: workoutError } = await supabase
          .from('workouts')
          .select('id, status')
          .eq('id', workoutId)
          .eq('user_id', userId)
          .maybeSingle();

        if (workoutError) throw workoutError;
        if (workout === null) {
          throw new RouteError(jsonError(404, 'NOT_FOUND', 'Workout not found'));
        }
        if (workout.status !== 'in_progress') {
          throw new RouteError(
            jsonError(422, 'WORKOUT_NOT_IN_PROGRESS', 'Cannot add exercises to a completed or expired workout'),
          );
        }

        const { data: exercise, error: exerciseError } = await supabase
          .from('exercises')
          .select('id')
          .eq('id', exerciseId)
          .or(`user_id.is.null,user_id.eq.${userId}`)
          .maybeSingle();

        if (exerciseError) throw exerciseError;
        if (exercise === null) {
          throw new RouteError(jsonError(422, 'INVALID_EXERCISE', 'Exercise not found or not accessible'));
        }

        const { data: inserted, error: insertError } = await supabase
          .from('workout_exercises')
          .insert({ workout_id: workoutId, exercise_id: exerciseId, position, client_mutation_id: clientMutationId })
          .select('id')
          .single();

        if (insertError) {
          if (insertError.code === '23505') {
            // A previous execution inserted the row but failed before writing the
            // mutation receipt.  Select the existing row to return a stable id.
            const { data: existing, error: selectError } = await supabase
              .from('workout_exercises')
              .select('id')
              .eq('client_mutation_id', clientMutationId)
              .maybeSingle();
            if (selectError) throw selectError;
            if (!existing) throw insertError;
            await touchWorkoutLastActivity(supabase, workoutId, new Date().toISOString());
            return { resourceId: existing.id, response: { id: existing.id, clientMutationId } };
          }
          throw insertError;
        }

        await touchWorkoutLastActivity(supabase, workoutId, new Date().toISOString());

        return { resourceId: inserted.id, response: { id: inserted.id, clientMutationId } };
      },
    });

    if (result.replayed) {
      return jsonOk({ id: result.resourceId!, clientMutationId });
    }

    return jsonCreated(result.response!);
  } catch (err) {
    if (err instanceof RouteError) return err.response;
    return handleApiError(err);
  }
}
