'use client';

import type { User } from '@supabase/supabase-js';
import { Dumbbell, Home, LogOut, User as UserIcon } from 'lucide-react';

import { signOut } from '@/app/(app)/profile/actions';

import { NavItem } from './NavItem';

const NAV_ITEMS = [
  { href: '/home', label: 'Home', icon: Home },
  { href: '/train', label: 'Train', icon: Dumbbell },
  { href: '/profile', label: 'Profile', icon: UserIcon },
] as const;

interface AppSidebarProps {
  user: User;
}

export function AppSidebar({ user }: AppSidebarProps) {
  return (
    <aside className="hidden md:flex md:w-60 md:flex-col md:border-r fixed left-0 top-0 h-full bg-background">
      <div className="flex h-full flex-col px-3 py-4">
        <div className="mb-6 px-3">
          <span className="text-lg font-bold tracking-tight">LimenFit</span>
        </div>

        <nav className="flex flex-1 flex-col gap-1">
          {NAV_ITEMS.map((item) => (
            <NavItem key={item.href} {...item} variant="sidebar" />
          ))}
        </nav>

        <div className="mt-auto flex flex-col gap-2 border-t pt-4">
          <p className="truncate px-3 text-xs text-muted-foreground">{user.email}</p>
          <form action={signOut}>
            <button
              type="submit"
              className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              <LogOut className="h-4 w-4 shrink-0" />
              Sign Out
            </button>
          </form>
        </div>
      </div>
    </aside>
  );
}
