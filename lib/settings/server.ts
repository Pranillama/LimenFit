import type { SupabaseClient } from '@supabase/supabase-js';

import { assertServerOnly } from '@/lib/env';
import type { Database } from '@/lib/supabase/types';
import type { UserSettingsDTO } from '@/lib/schemas/settings';

assertServerOnly();

export async function getOrCreateUserSettings(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<UserSettingsDTO> {
  const { data, error } = await supabase
    .from('user_settings')
    .select('weight_unit, rest_timer_default_seconds')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;

  if (data) {
    return {
      weightUnit: data.weight_unit,
      restTimerDefaultSeconds: data.rest_timer_default_seconds,
    };
  }

  const { data: inserted, error: insertError } = await supabase
    .from('user_settings')
    .insert({ user_id: userId })
    .select('weight_unit, rest_timer_default_seconds')
    .single();

  if (insertError) {
    if (insertError.code === '23505') {
      const { data: existing, error: existingError } = await supabase
        .from('user_settings')
        .select('weight_unit, rest_timer_default_seconds')
        .eq('user_id', userId)
        .single();
      if (existingError) throw existingError;
      return {
        weightUnit: existing.weight_unit,
        restTimerDefaultSeconds: existing.rest_timer_default_seconds,
      };
    }
    throw insertError;
  }

  return {
    weightUnit: inserted.weight_unit,
    restTimerDefaultSeconds: inserted.rest_timer_default_seconds,
  };
}
