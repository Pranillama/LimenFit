'use client';

import { Dumbbell, Home, Sparkles, User } from 'lucide-react';

import { NavItem } from './NavItem';

const BASE_NAV_ITEMS = [
  { href: '/home', label: 'Home', icon: Home },
  { href: '/train', label: 'Train', icon: Dumbbell },
] as const;

const ASK_ITEM = { href: '/ask', label: 'Ask', icon: Sparkles } as const;

const PROFILE_ITEM = { href: '/profile', label: 'Profile', icon: User } as const;

interface MobileBottomNavProps {
  aiEnabled: boolean;
}

export function MobileBottomNav({ aiEnabled }: MobileBottomNavProps) {
  const items = aiEnabled
    ? [...BASE_NAV_ITEMS, ASK_ITEM, PROFILE_ITEM]
    : [...BASE_NAV_ITEMS, PROFILE_ITEM];

  return (
    <nav
      className="fixed inset-x-0 bottom-0 border-t bg-background pb-[max(env(safe-area-inset-bottom),0px)] md:hidden"
      aria-label="Mobile navigation"
    >
      <div className="flex">
        {items.map((item) => (
          <NavItem key={item.href} {...item} variant="mobile" />
        ))}
      </div>
    </nav>
  );
}
