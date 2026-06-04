import { requireUser } from '@/lib/api/auth';
import { handleApiError, jsonOk } from '@/lib/api/responses';
import { getOrCreateProfile } from '@/lib/profile';
import { profilePatchBodySchema, type ProfileDTO } from '@/lib/schemas/profile';

export const runtime = 'nodejs';

const PROFILE_COLUMNS =
  'first_name, last_name, display_name, username, avatar_url, date_of_birth, gender, ' +
  'height_cm, starting_weight_kg, time_zone, primary_goal, goal_weight_kg, ' +
  'target_daily_calories, activity_level, training_experience, weekly_training_frequency';

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

type ProfileRow = Record<string, unknown> & {
  first_name: string | null;
  last_name: string | null;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
  date_of_birth: string | null;
  gender: ProfileDTO['gender'];
  height_cm: number | null;
  starting_weight_kg: number | null;
  time_zone: string | null;
  primary_goal: ProfileDTO['primaryGoal'];
  goal_weight_kg: number | null;
  target_daily_calories: number | null;
  activity_level: ProfileDTO['activityLevel'];
  training_experience: ProfileDTO['trainingExperience'];
  weekly_training_frequency: number | null;
};

function rowToDTO(row: ProfileRow): ProfileDTO {
  return {
    firstName: row.first_name,
    lastName: row.last_name,
    displayName: row.display_name,
    username: row.username,
    avatarUrl: row.avatar_url,
    dateOfBirth: row.date_of_birth,
    gender: row.gender,
    heightCm: row.height_cm === null ? null : Number(row.height_cm),
    startingWeightKg: row.starting_weight_kg === null ? null : Number(row.starting_weight_kg),
    timeZone: row.time_zone,
    primaryGoal: row.primary_goal,
    goalWeightKg: row.goal_weight_kg === null ? null : Number(row.goal_weight_kg),
    targetDailyCalories: row.target_daily_calories,
    activityLevel: row.activity_level,
    trainingExperience: row.training_experience,
    weeklyTrainingFrequency: row.weekly_training_frequency,
  };
}

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
    return jsonOk<ProfileDTO>(rowToDTO(data as ProfileRow));
  } catch (err) {
    return handleApiError(err);
  }
}
