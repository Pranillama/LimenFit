'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { toast } from '@/components/ui/sonner';
import { newClientMutationId } from '@/lib/idempotency';

export function useDeletePlanMutation() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, { id: string }>({
    mutationFn: async ({ id }) => {
      const clientMutationId = newClientMutationId();

      const response = await fetch(`/api/plans/${id}`, {
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
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['plans'] });
    },
    onError: () => {
      toast.error('Failed to delete plan');
    },
  });
}
