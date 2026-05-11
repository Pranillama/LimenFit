'use client';

import { SignOutButton } from '@/app/(app)/profile/sign-out-button';

import { AccountInfo } from './AccountInfo';
import { SettingsForm } from './SettingsForm';

interface ProfileViewProps {
  email: string | null;
}

export function ProfileView({ email }: ProfileViewProps) {
  return (
    <div className="space-y-8">
      <section className="space-y-2">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Account
        </h2>
        <AccountInfo email={email} />
      </section>

      <section className="space-y-4">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Settings
        </h2>
        <SettingsForm />
      </section>

      <div className="border-t pt-6">
        <SignOutButton />
      </div>
    </div>
  );
}
