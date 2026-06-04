'use client';

import { LogOut } from 'lucide-react';

import { useHardenedSignOut } from '@/features/shell/useHardenedSignOut';

export function SignOutButton() {
  const { handleSignOut, isPending } = useHardenedSignOut();

  return (
    <button
      type="button"
      onClick={handleSignOut}
      disabled={isPending}
      className="flex w-full items-center justify-center gap-2 rounded-xl bg-destructive px-4 py-3 text-sm font-medium text-destructive-foreground transition-colors hover:bg-destructive/90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-destructive disabled:opacity-50"
    >
      <LogOut className="h-4 w-4" />
      {isPending ? 'Signing out…' : 'Sign out'}
    </button>
  );
}
