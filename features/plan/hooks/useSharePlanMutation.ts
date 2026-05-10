'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { toast } from '@/components/ui/sonner';
import { newClientMutationId } from '@/lib/idempotency';

export type SharePlanResponse = {
  id: string;
  clientMutationId: string;
  shareSlug: string;
  isPublic: boolean;
};

export function useSharePlanMutation() {
  const queryClient = useQueryClient();

  return useMutation<SharePlanResponse, Error, { id: string }>({
    mutationFn: async ({ id }) => {
      const clientMutationId = newClientMutationId();

      const response = await fetch(`/api/plans/${id}/share`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': clientMutationId,
        },
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

      return response.json() as Promise<SharePlanResponse>;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['plans'] });
    },
    onError: () => {
      toast.error('Failed to share plan');
    },
  });
}
