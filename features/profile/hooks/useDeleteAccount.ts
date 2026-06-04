'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { useActiveWorkoutStore } from '@/features/workout/store/useActiveWorkoutStore';
import { clearPendingDuplicate } from '@/features/plan/lib/pendingDuplicate';

export function useDeleteAccount() {
  const [isDeleting, setIsDeleting] = React.useState(false);
  const router = useRouter();
  const queryClient = useQueryClient();

  async function deleteAccount(): Promise<void> {
    setIsDeleting(true);
    try {
      const res = await fetch('/api/account/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm: 'DELETE' }),
      });
      if (!res.ok) {
        toast.error('Failed to delete account. Please try again.');
        return;
      }

      // Mirror the sign-out cleanup contract.
      useActiveWorkoutStore.getState().resetStore();
      useActiveWorkoutStore.persist.clearStorage();
      queryClient.clear();
      clearPendingDuplicate();
      toast.dismiss('persistence-degraded');

      router.replace('/auth');
    } finally {
      setIsDeleting(false);
    }
  }

  return { deleteAccount, isDeleting };
}
