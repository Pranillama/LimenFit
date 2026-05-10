'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { toast } from '@/components/ui/sonner';

import type { PlanMutationResponse } from './useCreatePlanMutation';

export type DuplicatePlanInput = {
  shareSlug: string;
  clientMutationId: string;
};

export function useDuplicatePlanMutation() {
  const queryClient = useQueryClient();

  return useMutation<PlanMutationResponse, Error, DuplicatePlanInput>({
    mutationFn: async ({ shareSlug, clientMutationId }) => {
      const response = await fetch('/api/plans/duplicate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': clientMutationId,
        },
        body: JSON.stringify({ clientMutationId, sourceShareSlug: shareSlug }),
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

      return response.json() as Promise<PlanMutationResponse>;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['plans'] });
    },
    onError: () => {
      toast.error('Failed to duplicate plan');
    },
  });
}
