import { PreferencesForm } from '@/features/profile';
import { createSupabaseServerClient } from '@/lib/supabase/server-exports';

export default async function PreferencesPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: settings } = await supabase
    .from('user_settings')
    .select('weight_unit, height_unit, rest_timer_default_seconds')
    .eq('user_id', user.id)
    .maybeSingle();

  return (
    <PreferencesForm
      defaultWeightUnit={settings?.weight_unit ?? 'lbs'}
      defaultHeightUnit={settings?.height_unit ?? 'ft'}
      defaultRestTimerSeconds={settings?.rest_timer_default_seconds ?? 60}
    />
  );
}
