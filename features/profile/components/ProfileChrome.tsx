'use client';

import { ArrowLeft } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';

import type { ProfileDTO } from '@/lib/schemas/profile';

import { ProfileHeader } from './ProfileHeader';

interface ProfileChromeProps {
  profile: ProfileDTO | null;
  email: string | null;
}

export function ProfileChrome({ profile, email }: ProfileChromeProps) {
  const pathname = usePathname();
  const router = useRouter();
  const isLanding = pathname === '/profile';

  function handleBack() {
    router.push('/profile');
  }

  return (
    <>
      {!isLanding ? (
        <>
          {/* Fixed bar — always visible while scrolling on mobile/tablet */}
          <div className="fixed inset-x-0 top-0 z-20 border-b border-border bg-background px-4 py-3 md:left-60 md:px-6 lg:hidden">
            <button
              type="button"
              onClick={handleBack}
              className="inline-flex items-center gap-1 text-sm font-medium text-brand"
            >
              <ArrowLeft className="h-4 w-4" />
              Profile
            </button>
          </div>
          {/* Spacer — bar ≈44px, PageContainer py-6=24px already, target ~24px visible gap so 44px extra */}
          <div className="h-11 lg:hidden" aria-hidden="true" />
        </>
      ) : null}

      <div className={isLanding ? '' : 'hidden lg:block'}>
        <h1 className="mb-1 text-2xl font-semibold tracking-tight">Profile</h1>
        <p className="mb-6 text-sm text-muted-foreground">
          Manage your account, training profile, and preferences.
        </p>

        <div className="mb-6">
          {profile ? <ProfileHeader profile={profile} email={email} /> : null}
        </div>
      </div>
    </>
  );
}
