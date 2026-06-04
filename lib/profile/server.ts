import type { SupabaseClient } from '@supabase/supabase-js';

import { assertServerOnly } from '@/lib/env';
import type { Database } from '@/lib/supabase/types';
import type { ProfileDTO } from '@/lib/schemas/profile';

assertServerOnly();

const PROFILE_COLUMNS =
  'first_name, last_name, display_name, username, avatar_url, date_of_birth, gender, ' +
  'height_cm, starting_weight_kg, time_zone, primary_goal, goal_weight_kg, ' +
  'target_daily_calories, activity_level, training_experience, weekly_training_frequency';

type ProfileRow = {
  first_name: string | null;
  last_name: string | null;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
  date_of_birth: string | null;
  gender: Database['public']['Enums']['gender'] | null;
  height_cm: number | null;
  starting_weight_kg: number | null;
  time_zone: string | null;
  primary_goal: Database['public']['Enums']['fitness_goal'] | null;
  goal_weight_kg: number | null;
  target_daily_calories: number | null;
  activity_level: Database['public']['Enums']['activity_level'] | null;
  training_experience: Database['public']['Enums']['training_experience'] | null;
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

export async function getOrCreateProfile(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<ProfileDTO> {
  const { data, error } = await supabase
    .from('profiles')
    .select(PROFILE_COLUMNS)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;
  if (data) return rowToDTO(data as unknown as ProfileRow);

  const { data: inserted, error: insertError } = await supabase
    .from('profiles')
    .insert({ user_id: userId })
    .select(PROFILE_COLUMNS)
    .single();

  if (insertError) {
    if (insertError.code === '23505') {
      const { data: existing, error: existingError } = await supabase
        .from('profiles')
        .select(PROFILE_COLUMNS)
        .eq('user_id', userId)
        .single();
      if (existingError) throw existingError;
      return rowToDTO(existing as unknown as ProfileRow);
    }
    throw insertError;
  }

  return rowToDTO(inserted as unknown as ProfileRow);
}
