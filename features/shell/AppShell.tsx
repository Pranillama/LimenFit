'use client';

import type { User } from '@supabase/supabase-js';
import type { ReactNode } from 'react';

import { TooltipProvider } from '@/components/ui/tooltip';
import { ActiveWorkoutRuntime } from '@/features/workout/components/ActiveWorkoutRuntime';

import { AppSidebar } from './AppSidebar';
import { MobileBottomNav } from './MobileBottomNav';

interface AppShellProps {
  user: User;
  children: ReactNode;
}

export function AppShell({ user, children }: AppShellProps) {
  return (
    <TooltipProvider>
      <ActiveWorkoutRuntime />
      <div className="min-h-screen">
        <AppSidebar user={user} />
        <main className="pb-[calc(4rem+max(env(safe-area-inset-bottom),0px))] md:pb-0 md:pl-60">
          {children}
        </main>
        <MobileBottomNav />
      </div>
    </TooltipProvider>
  );
}
