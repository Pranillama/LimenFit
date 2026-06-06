import { FitnessProfileForm } from '@/features/profile';
import { getOrCreateProfile } from '@/lib/profile';
import { createSupabaseServerClient } from '@/lib/supabase/server-exports';

export default async function FitnessPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const [profile, settingsResult] = await Promise.all([
    getOrCreateProfile(supabase, user.id),
    supabase.from('user_settings').select('weight_unit').eq('user_id', user.id).maybeSingle(),
  ]);

  const defaultWeightUnit: 'lbs' | 'kg' = settingsResult.data?.weight_unit ?? 'lbs';

  return <FitnessProfileForm profile={profile} defaultWeightUnit={defaultWeightUnit} />;
}
