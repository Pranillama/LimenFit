'use client';

import { Dumbbell, Home, User } from 'lucide-react';

import { NavItem } from './NavItem';

const NAV_ITEMS = [
  { href: '/home', label: 'Home', icon: Home },
  { href: '/train', label: 'Train', icon: Dumbbell },
  { href: '/profile', label: 'Profile', icon: User },
] as const;

export function MobileBottomNav() {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 border-t bg-background pb-[max(env(safe-area-inset-bottom),0px)] md:hidden"
      aria-label="Mobile navigation"
    >
      <div className="flex">
        {NAV_ITEMS.map((item) => (
          <NavItem key={item.href} {...item} variant="mobile" />
        ))}
      </div>
    </nav>
  );
}
