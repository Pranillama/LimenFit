import { AccountSection } from '@/features/profile/components/AccountSection';
import { createSupabaseServerClient } from '@/lib/supabase/server-exports';

export default async function AccountPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return <AccountSection email={user?.email ?? null} />;
}
