import { requireUser } from '@/lib/api/auth';
import { handleApiError, jsonOk } from '@/lib/api/responses';
import { getOrCreateProfile, PROFILE_COLUMNS, rowToDTO, type ProfileRow } from '@/lib/profile';
import { profilePatchBodySchema, type ProfileDTO } from '@/lib/schemas/profile';

export const runtime = 'nodejs';

const CAMEL_TO_SNAKE: Record<string, string> = {
  firstName: 'first_name',
  lastName: 'last_name',
  displayName: 'display_name',
  username: 'username',
  avatarUrl: 'avatar_url',
  dateOfBirth: 'date_of_birth',
  gender: 'gender',
  heightCm: 'height_cm',
  startingWeightKg: 'starting_weight_kg',
  timeZone: 'time_zone',
  primaryGoal: 'primary_goal',
  goalWeightKg: 'goal_weight_kg',
  targetDailyCalories: 'target_daily_calories',
  activityLevel: 'activity_level',
  trainingExperience: 'training_experience',
  weeklyTrainingFrequency: 'weekly_training_frequency',
};

export async function GET(_request: Request): Promise<Response> {
  try {
    const { supabase, user } = await requireUser();
    const profile = await getOrCreateProfile(supabase, user.id);
    return jsonOk<ProfileDTO>(profile);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(request: Request): Promise<Response> {
  try {
    const { supabase, user } = await requireUser();
    const body = profilePatchBodySchema.parse(await request.json());

    const patchFields: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(body)) {
      const col = CAMEL_TO_SNAKE[k];
      if (col !== undefined) patchFields[col] = v;
    }

    const { data, error } = await supabase
      .from('profiles')
      .upsert(
        { user_id: user.id, ...patchFields },
        { onConflict: 'user_id', ignoreDuplicates: false },
      )
      .select(PROFILE_COLUMNS)
      .single();

    if (error) throw error;
    return jsonOk<ProfileDTO>(rowToDTO(data as unknown as ProfileRow));
  } catch (err) {
    return handleApiError(err);
  }
}
