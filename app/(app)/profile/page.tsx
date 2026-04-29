import type { Metadata } from 'next';

import { PageContainer } from '@/components/page-container';
import { createSupabaseServerClient } from '@/lib/supabase/server-exports';

import { SignOutButton } from './sign-out-button';

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
      {user?.email && <p className="mb-6 text-muted-foreground">{user.email}</p>}
      <SignOutButton />
      <p className="mt-6 text-sm text-muted-foreground">Settings coming in T15.</p>
    </PageContainer>
  );
}
