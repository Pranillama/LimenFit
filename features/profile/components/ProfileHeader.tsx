'use client';

import { Pencil } from 'lucide-react';
import * as React from 'react';

import type { ProfileDTO } from '@/lib/schemas/profile';

interface ProfileHeaderProps {
  profile: ProfileDTO;
  email: string | null;
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

export function ProfileHeader({ profile, email }: ProfileHeaderProps) {
  const handle = profile.username ? `@${profile.username}` : null;
  const subtitle = [handle, email].filter(Boolean).join(' · ');

  return (
    <div className="flex items-center gap-4 rounded-xl border border-border bg-card p-6">
      <div className="relative">
        {profile.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={profile.avatarUrl}
            alt=""
            className="h-14 w-14 rounded-full object-cover"
          />
        ) : (
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-secondary text-base font-semibold text-foreground">
            {initials(profile, email)}
          </div>
        )}
        <button
          type="button"
          disabled
          aria-label="Change profile photo (coming soon)"
          className="absolute -bottom-1 -right-1 inline-flex h-6 w-6 items-center justify-center rounded-full border-2 border-background bg-secondary text-muted-foreground opacity-60 hover:bg-brand hover:text-brand-foreground disabled:cursor-not-allowed"
        >
          <Pencil className="h-3 w-3" />
        </button>
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[18px] font-semibold leading-tight">{displayName(profile, email)}</p>
        {subtitle ? (
          <p className="truncate text-sm text-muted-foreground">{subtitle}</p>
        ) : null}
      </div>
    </div>
  );
}
