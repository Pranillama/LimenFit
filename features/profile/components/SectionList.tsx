'use client';

import { CreditCard, Ruler, Sliders, Target, UserRound } from 'lucide-react';
import { usePathname } from 'next/navigation';
import * as React from 'react';

import { SignOutButton } from '@/app/(app)/profile/sign-out-button';

import { SectionRow } from './ui/SectionRow';

export type SectionKey = 'personal' | 'fitness' | 'body' | 'preferences' | 'subscription';

interface SectionListProps {
  activeSection?: SectionKey;
  className?: string;
}

const SECTIONS: Array<{
  key: SectionKey;
  href: string;
  label: string;
  sublabel: string;
  icon: typeof UserRound;
}> = [
  {
    key: 'personal',
    href: '/profile/personal',
    label: 'Personal info',
    sublabel: 'Name, age, height & basics',
    icon: UserRound,
  },
  {
    key: 'fitness',
    href: '/profile/fitness',
    label: 'Fitness profile',
    sublabel: 'Goals, activity & experience',
    icon: Target,
  },
  {
    key: 'body',
    href: '/profile/body-metrics',
    label: 'Body metrics',
    sublabel: 'BMI, weight & measurements',
    icon: Ruler,
  },
  {
    key: 'preferences',
    href: '/profile/preferences',
    label: 'Preferences',
    sublabel: 'Units, rest timer & defaults',
    icon: Sliders,
  },
  {
    key: 'subscription',
    href: '/profile/subscription',
    label: 'Subscription',
    sublabel: 'Plan & usage',
    icon: CreditCard,
  },
];

function pathToKey(pathname: string | null): SectionKey | undefined {
  if (!pathname) return undefined;
  return SECTIONS.find((s) => pathname.startsWith(s.href))?.key;
}

export function SectionList({ activeSection, className }: SectionListProps) {
  const pathname = usePathname();
  const resolved = activeSection ?? pathToKey(pathname);

  return (
    <nav className={className} aria-label="Profile sections">
      <ul className="flex flex-col gap-1">
        {SECTIONS.map((s) => (
          <li key={s.key}>
            <SectionRow
              icon={s.icon}
              label={s.label}
              sublabel={s.sublabel}
              href={s.href}
              active={s.key === resolved}
            />
          </li>
        ))}
      </ul>
      <div className="mt-6">
        <SignOutButton />
      </div>
    </nav>
  );
}
