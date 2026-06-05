import { requireUser } from '@/lib/api/auth';
import { handleApiError, jsonOk } from '@/lib/api/responses';
import { userSettingsPatchBodySchema, type UserSettingsDTO } from '@/lib/schemas/settings';

export const runtime = 'nodejs';

export async function PATCH(request: Request): Promise<Response> {
  try {
    const { supabase, user } = await requireUser();

    const body = userSettingsPatchBodySchema.parse(await request.json());

    const patchFields: Record<string, unknown> = {};
    if (body.weightUnit !== undefined) patchFields.weight_unit = body.weightUnit;
    if (body.heightUnit !== undefined) patchFields.height_unit = body.heightUnit;
    if (body.restTimerDefaultSeconds !== undefined) {
      patchFields.rest_timer_default_seconds = body.restTimerDefaultSeconds;
    }

    const { data, error } = await supabase
      .from('user_settings')
      .upsert(
        { user_id: user.id, ...patchFields },
        { onConflict: 'user_id', ignoreDuplicates: false },
      )
      .select('weight_unit, height_unit, rest_timer_default_seconds')
      .single();

    if (error) throw error;

    return jsonOk<UserSettingsDTO>({
      weightUnit: data.weight_unit,
      heightUnit: data.height_unit,
      restTimerDefaultSeconds: data.rest_timer_default_seconds,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
