import { requireUser } from '@/lib/api/auth';
import { handleApiError, jsonCreated, jsonOk } from '@/lib/api/responses';
import { withIdempotency } from '@/lib/idempotency/server';
import { exerciseCreateBodySchema } from '@/lib/schemas/exercise';
import type { ExerciseCategory, ExerciseEquipment } from '@/lib/exercises/catalog';

export const runtime = 'nodejs';

class RouteError extends Error {
  constructor(public readonly response: Response) {
    super('RouteError');
    this.name = 'RouteError';
  }
}

type ExerciseCreateResponse = {
  id: string;
  clientMutationId: string;
  name: string;
  category: ExerciseCategory;
  equipment: ExerciseEquipment | null;
  isCustom: true;
};

export async function POST(request: Request): Promise<Response> {
  try {
    const { supabase, user } = await requireUser();
    const userId = user.id;

    const body = exerciseCreateBodySchema.parse(await request.json());
    const { clientMutationId, name, category, equipment } = body;

    const result = await withIdempotency<ExerciseCreateResponse>({
      supabase,
      userId,
      clientMutationId,
      mutationType: 'exercise.create',
      resourceType: 'exercises',
      handler: async () => {
        const { data: inserted, error: insertError } = await supabase
          .from('exercises')
          .insert({ user_id: userId, is_custom: true, name, category, equipment, client_mutation_id: clientMutationId })
          .select('id, name, category, equipment, is_custom')
          .single();

        if (insertError) {
          // Unique-violation on client_mutation_id: a concurrent request already inserted
          // this exercise. Fetch and return the existing row so both requests converge on
          // the same id, and let withIdempotency handle the receipt race normally.
          if (insertError.code === '23505') {
            const { data: existing, error: existingError } = await supabase
              .from('exercises')
              .select('id, name, category, equipment, is_custom')
              .eq('client_mutation_id', clientMutationId)
              .single();
            if (existingError) throw existingError;
            return {
              resourceId: existing.id,
              response: {
                id: existing.id,
                clientMutationId,
                name: existing.name,
                category: existing.category as ExerciseCategory,
                equipment: existing.equipment as ExerciseEquipment | null,
                isCustom: true,
              },
            };
          }
          throw insertError;
        }

        return {
          resourceId: inserted.id,
          response: {
            id: inserted.id,
            clientMutationId,
            name: inserted.name,
            category: inserted.category as ExerciseCategory,
            equipment: inserted.equipment as ExerciseEquipment | null,
            isCustom: true,
          },
        };
      },
    });

    if (result.replayed) {
      const { data: row, error: fetchError } = await supabase
        .from('exercises')
        .select('id, name, category, equipment, is_custom')
        .eq('id', result.resourceId!)
        .single();

      if (fetchError) throw fetchError;

      return jsonOk<ExerciseCreateResponse>({
        id: row.id,
        clientMutationId,
        name: row.name,
        category: row.category as ExerciseCategory,
        equipment: row.equipment as ExerciseEquipment | null,
        isCustom: true,
      });
    }

    return jsonCreated(result.response!);
  } catch (err) {
    if (err instanceof RouteError) return err.response;
    return handleApiError(err);
  }
}
