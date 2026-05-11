'use client';

import { useHardenedSignOut } from '@/features/shell/useHardenedSignOut';

export function SignOutButton() {
  const { handleSignOut, isPending } = useHardenedSignOut();

  return (
    <button
      type="button"
      onClick={handleSignOut}
      disabled={isPending}
      className="rounded-md bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground transition-colors hover:bg-destructive/90 disabled:opacity-50"
    >
      {isPending ? 'Signing out…' : 'Sign Out'}
    </button>
  );
}
