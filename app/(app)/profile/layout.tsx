import type { Metadata } from 'next';
import * as React from 'react';

import { PageContainer } from '@/components/page-container';
import { ProfileHeader } from '@/features/profile/components/ProfileHeader';
import { SectionList } from '@/features/profile/components/SectionList';
import { getOrCreateProfile } from '@/lib/profile';
import { createSupabaseServerClient } from '@/lib/supabase/server-exports';

export const metadata: Metadata = {
  title: 'Profile — LimenFit',
};

export default async function ProfileLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const profile = user ? await getOrCreateProfile(supabase, user.id) : null;
  const email = user?.email ?? null;

  return (
    <PageContainer title="Profile" className="lg:max-w-5xl">
      <p className="-mt-2 mb-6 text-sm text-muted-foreground">
        Manage your account, training profile, and preferences.
      </p>

      <div className="mb-6">
        {profile ? <ProfileHeader profile={profile} email={email} /> : null}
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[300px_minmax(0,1fr)]">
        <div className="hidden lg:sticky lg:top-10 lg:block lg:self-start">
          <SectionList />
        </div>
        <div className="min-w-0">{children}</div>
      </div>
    </PageContainer>
  );
}
