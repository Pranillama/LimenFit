import { requireUser } from '@/lib/api/auth';
import { touchWorkoutLastActivity } from '@/lib/api/touchWorkout';
import { handleApiError, jsonCreated, jsonError, jsonOk } from '@/lib/api/responses';
import { withIdempotency } from '@/lib/idempotency/server';
import { setLogBodySchema } from '@/lib/schemas/set';

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

    const body = setLogBodySchema.parse(await request.json());
    const {
      clientMutationId,
      workoutExerciseId,
      setNumber,
      reps,
      weightValue,
      weightUnit,
      loggedAt,
    } = body;

    const result = await withIdempotency({
      supabase,
      userId,
      clientMutationId,
      mutationType: 'set.log',
      resourceType: 'sets',
      handler: async () => {
        // Single join: verify exercise exists under an in_progress workout owned by this user.
        // RLS on workouts (user_id = auth.uid()) enforces ownership; !inner propagates the
        // filter so the exercise row is absent when the workout join misses.
        const { data: we, error: weError } = await supabase
          .from('workout_exercises')
          .select('id, workouts!inner(id, status)')
          .eq('id', workoutExerciseId)
          .maybeSingle();

        if (weError) throw weError;
        if (we === null) {
          throw new RouteError(jsonError(404, 'NOT_FOUND', 'Workout exercise not found'));
        }

        const workout = we.workouts as unknown as { id: string; status: string };
        if (workout.status !== 'in_progress') {
          throw new RouteError(
            jsonError(
              422,
              'WORKOUT_NOT_IN_PROGRESS',
              'Cannot log sets on a completed or expired workout',
            ),
          );
        }

        const { data: inserted, error: insertError } = await supabase
          .from('sets')
          .insert({
            workout_exercise_id: workoutExerciseId,
            set_number: setNumber,
            weight_value: weightValue,
            weight_unit: weightUnit,
            reps,
            logged_at: loggedAt,
            client_mutation_id: clientMutationId,
          })
          .select('id')
          .single();

        if (insertError) {
          // Unique-violation on client_mutation_id: a concurrent request already inserted
          // this set. Fetch and return the existing row so both requests converge on the
          // same id, and let withIdempotency handle the receipt race normally.
          if (insertError.code === '23505') {
            const { data: existing, error: existingError } = await supabase
              .from('sets')
              .select('id')
              .eq('client_mutation_id', clientMutationId)
              .single();
            if (existingError) throw existingError;
            await touchWorkoutLastActivity(supabase, workout.id, new Date().toISOString());
            return { resourceId: existing.id, response: { id: existing.id, clientMutationId } };
          }
          throw insertError;
        }

        await touchWorkoutLastActivity(supabase, workout.id, new Date().toISOString());

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
