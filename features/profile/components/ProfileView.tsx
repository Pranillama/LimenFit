'use client';

import { AccountSection } from './AccountSection';
import { SectionList } from './SectionList';

interface ProfileViewProps {
  email: string | null;
}

export function ProfileView({ email }: ProfileViewProps) {
  return (
    <div className="space-y-8">
      <div className="lg:hidden">
        <SectionList />
      </div>
      <AccountSection email={email} />
    </div>
  );
}
