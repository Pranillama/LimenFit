'use client';

import { useTransition } from 'react';
import { toast } from 'sonner';

import { signOut } from './actions';

export function SignOutButton() {
  const [isPending, startTransition] = useTransition();

  function handleSignOut() {
    startTransition(async () => {
      try {
        await signOut();
      } catch (error) {
        // redirect() from next/navigation throws NEXT_REDIRECT — that's the success path.
        // Any other error means sign-out failed.
        const digest = (error as { digest?: string })?.digest;
        if (digest?.startsWith('NEXT_REDIRECT')) return;
        toast.error('Failed to sign out. Please try again.');
      }
    });
  }

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
