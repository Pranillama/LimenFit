import { requireUser } from '@/lib/api/auth';
import { handleApiError, jsonCreated } from '@/lib/api/responses';
import { upsertTodayBodyweight, todayUtc } from '@/lib/body-metrics/server';
import { bodyweightLogBodySchema, type BodyweightEntryDTO } from '@/lib/schemas/body-metrics';

export const runtime = 'nodejs';

export async function POST(request: Request): Promise<Response> {
  try {
    const { supabase, user } = await requireUser();
    const body = bodyweightLogBodySchema.parse(await request.json());
    const entry = await upsertTodayBodyweight(supabase, user.id, body.weightKg, todayUtc());
    return jsonCreated<BodyweightEntryDTO>(entry);
  } catch (err) {
    return handleApiError(err);
  }
}
