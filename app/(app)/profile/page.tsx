import type { Metadata } from 'next';

import { PageContainer } from '@/components/page-container';
import { ProfileView } from '@/features/profile';
import { createSupabaseServerClient } from '@/lib/supabase/server-exports';

export const metadata: Metadata = {
  title: 'Profile — LimenFit',
};

export default async function ProfilePage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <PageContainer title="Profile">
      <ProfileView email={user?.email ?? null} />
    </PageContainer>
  );
}
