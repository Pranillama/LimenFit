'use client';

import { CreditCard, Ruler, Sliders, Target, UserRound } from 'lucide-react';
import * as React from 'react';

import { SignOutButton } from '@/app/(app)/profile/sign-out-button';

import { SectionRow } from './ui/SectionRow';

interface SectionListProps {
  activeSection?: SectionKey;
  className?: string;
}

export type SectionKey = 'personal' | 'fitness' | 'body' | 'preferences' | 'subscription';

const SECTIONS: Array<{
  key: SectionKey;
  href: string;
  label: string;
  sublabel: string;
  icon: typeof UserRound;
}> = [
  { key: 'personal',     href: '/profile/personal',     label: 'Personal info',     sublabel: 'Name, age, height & basics',     icon: UserRound },
  { key: 'fitness',      href: '/profile/fitness',      label: 'Fitness profile',   sublabel: 'Goals, activity & experience',   icon: Target },
  { key: 'body',         href: '/profile/body-metrics', label: 'Body metrics',      sublabel: 'BMI, weight & measurements',     icon: Ruler },
  { key: 'preferences',  href: '/profile/preferences',  label: 'Preferences',       sublabel: 'Units, rest timer & defaults',   icon: Sliders },
  { key: 'subscription', href: '/profile/subscription', label: 'Subscription',      sublabel: 'Plan & usage',                    icon: CreditCard },
];

export function SectionList({ activeSection, className }: SectionListProps) {
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
              active={s.key === activeSection}
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
