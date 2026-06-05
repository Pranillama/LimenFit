import { PersonalInfoForm } from '@/features/profile';
import { getOrCreateProfile } from '@/lib/profile';
import { createSupabaseServerClient } from '@/lib/supabase/server-exports';

export default async function PersonalPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const [profile, settingsResult] = await Promise.all([
    getOrCreateProfile(supabase, user.id),
    supabase
      .from('user_settings')
      .select('weight_unit, height_unit')
      .eq('user_id', user.id)
      .maybeSingle(),
  ]);

  const settings = settingsResult.data;
  const defaultHeightUnit: 'ft' | 'cm' = settings?.height_unit ?? 'ft';
  const defaultWeightUnit: 'lbs' | 'kg' = settings?.weight_unit ?? 'lbs';

  return (
    <PersonalInfoForm
      profile={profile}
      defaultHeightUnit={defaultHeightUnit}
      defaultWeightUnit={defaultWeightUnit}
    />
  );
}
