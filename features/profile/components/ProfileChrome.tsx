'use client';

import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import type { ProfileDTO } from '@/lib/schemas/profile';

import { ProfileHeader } from './ProfileHeader';

interface ProfileChromeProps {
  profile: ProfileDTO | null;
  email: string | null;
}

export function ProfileChrome({ profile, email }: ProfileChromeProps) {
  const pathname = usePathname();
  const isLanding = pathname === '/profile';

  return (
    <>
      {!isLanding ? (
        <div className="mb-4 lg:hidden">
          <Link
            href="/profile"
            className="inline-flex items-center gap-1 text-sm font-medium text-brand"
          >
            <ArrowLeft className="h-4 w-4" />
            Profile
          </Link>
        </div>
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
