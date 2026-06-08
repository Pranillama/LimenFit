import { requireUser } from '@/lib/api/auth';
import { handleApiError, jsonOk } from '@/lib/api/responses';
import { upsertTodayMeasurements, todayUtc } from '@/lib/body-metrics/server';
import { measurementsPatchBodySchema, type MeasurementsDTO } from '@/lib/schemas/body-metrics';

export const runtime = 'nodejs';

const CAMEL_TO_SNAKE: Record<string, string> = {
  bodyFatPct: 'body_fat_pct',
  waistCm: 'waist_cm',
  chestCm: 'chest_cm',
  armsCm: 'arms_cm',
  legsCm: 'legs_cm',
};

export async function PATCH(request: Request): Promise<Response> {
  try {
    const { supabase, user } = await requireUser();
    const body = measurementsPatchBodySchema.parse(await request.json());

    const fields: Record<string, number | null> = {};
    for (const [k, v] of Object.entries(body)) {
      const col = CAMEL_TO_SNAKE[k];
      if (col !== undefined) fields[col] = v as number | null;
    }

    const dto = await upsertTodayMeasurements(supabase, user.id, fields, todayUtc());
    return jsonOk<MeasurementsDTO>(dto);
  } catch (err) {
    return handleApiError(err);
  }
}
