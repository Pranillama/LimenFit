import { redirect } from 'next/navigation';

import { SettingsHydrator } from '@/features/shell';
import { getOrCreateUserSettings } from '@/lib/settings/server';
import { createSupabaseServerClient } from '@/lib/supabase/server-exports';

export default async function AppTemplate({ children }: { children: React.ReactNode }) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth');
  }

  const settings = await getOrCreateUserSettings(supabase, user.id);

  return (
    <>
      <SettingsHydrator initial={settings} />
      {children}
    </>
  );
}
