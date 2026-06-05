'use client';

import { usePathname } from 'next/navigation';
import * as React from 'react';

import { cn } from '@/lib/utils';

export default function ProfileTemplate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLanding = pathname === '/profile';

  return (
    <div
      className={cn(
        'lg:contents',
        !isLanding && 'motion-safe:animate-[profile-push_300ms_ease-out]',
      )}
    >
      {children}
    </div>
  );
}
