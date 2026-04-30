import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@/lib/supabase/types';

/**
 * Bumps last_activity_at on the given workout.
 * Skips silently when the workout is already completed or expired — the UPDATE
 * simply matches zero rows via the status filter, which is the desired no-op.
 * RLS scopes the UPDATE to the calling user's workouts.
 */
export async function touchWorkoutLastActivity(
  supabase: SupabaseClient<Database>,
  workoutId: string,
  ts: string,
): Promise<void> {
  const { error } = await supabase
    .from('workouts')
    .update({ last_activity_at: ts })
    .eq('id', workoutId)
    .neq('status', 'completed')
    .neq('status', 'expired');

  if (error) throw error;
}
