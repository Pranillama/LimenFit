'use client';

import { SectionList } from './SectionList';

export function ProfileView() {
  return (
    <div className="space-y-8">
      <div className="lg:hidden">
        <SectionList />
      </div>
    </div>
  );
}
