'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';

import { toast } from '@/components/ui/sonner';
import { newClientMutationId } from '@/lib/idempotency';
import { clearCompletedSession, useActiveWorkoutStore } from '../store/useActiveWorkoutStore';

export function useDeleteWorkoutMutation() {
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation<void, Error, { id: string }>({
    mutationFn: async ({ id }) => {
      const clientMutationId = newClientMutationId();

      const response = await fetch(`/api/workouts/${id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientMutationId }),
      });

      if (!response.ok) {
        let message = `HTTP ${response.status}`;
        try {
          const body = (await response.json()) as { error?: { message?: string } };
          if (body.error?.message) message = body.error.message;
        } catch {
          // ignore parse errors
        }
        throw new Error(message);
      }
    },
    onSuccess: (_, { id }) => {
      const meta = useActiveWorkoutStore.getState().meta;
      if (meta?.workoutId === id) {
        clearCompletedSession();
      }
      void queryClient.invalidateQueries({ queryKey: ['workout-history'] });
      router.push('/train/history');
    },
    onError: () => {
      toast.error('Failed to delete workout');
    },
  });
}
