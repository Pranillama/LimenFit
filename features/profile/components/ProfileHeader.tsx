'use client';

import type { ProfileDTO } from '@/lib/schemas/profile';

import { AvatarUploader } from './AvatarUploader';

interface ProfileHeaderProps {
  profile: ProfileDTO;
  email: string | null;
  userId: string;
}

function initials(profile: ProfileDTO, email: string | null): string {
  const first = profile.firstName?.trim()?.[0];
  const last = profile.lastName?.trim()?.[0];
  if (first && last) return `${first}${last}`.toUpperCase();
  if (first) return first.toUpperCase();
  const base = profile.displayName ?? profile.username ?? email ?? '?';
  return base.trim()[0]?.toUpperCase() ?? '?';
}

function displayName(profile: ProfileDTO, email: string | null): string {
  if (profile.displayName?.trim()) return profile.displayName;
  const combined = [profile.firstName, profile.lastName].filter(Boolean).join(' ').trim();
  if (combined) return combined;
  if (email) return email.split('@')[0] ?? email;
  return 'Your profile';
}

export function ProfileHeader({ profile, email, userId }: ProfileHeaderProps) {
  const handle = profile.username ? `@${profile.username}` : null;
  const subtitle = [handle, email].filter(Boolean).join(' · ');

  return (
    <div className="flex items-center gap-4 rounded-xl border border-border bg-card p-6">
      <AvatarUploader
        userId={userId}
        avatarUrl={profile.avatarUrl}
        initials={initials(profile, email)}
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[18px] font-semibold leading-tight">
          {displayName(profile, email)}
        </p>
        {subtitle ? <p className="truncate text-sm text-muted-foreground">{subtitle}</p> : null}
      </div>
    </div>
  );
}
