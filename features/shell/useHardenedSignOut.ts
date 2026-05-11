'use client';

import { useTransition } from 'react';

import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { signOut } from '@/app/(app)/profile/actions';
import { clearPendingDuplicate } from '@/features/plan/lib/pendingDuplicate';
import { useActiveWorkoutStore } from '@/features/workout/store/useActiveWorkoutStore';

export function useHardenedSignOut() {
  const [isPending, startTransition] = useTransition();
  const queryClient = useQueryClient();

  function handleSignOut() {
    startTransition(async () => {
      try {
        useActiveWorkoutStore.getState().resetStore();
        useActiveWorkoutStore.persist.clearStorage();
        queryClient.clear();
        clearPendingDuplicate();
        toast.dismiss('persistence-degraded');

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

  return { handleSignOut, isPending };
}
