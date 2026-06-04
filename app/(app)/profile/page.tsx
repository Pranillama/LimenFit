import { ProfileView } from '@/features/profile';
import { createSupabaseServerClient } from '@/lib/supabase/server-exports';

export default async function ProfilePage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return <ProfileView email={user?.email ?? null} />;
}
