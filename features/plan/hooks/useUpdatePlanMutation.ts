'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';

import { toast } from '@/components/ui/sonner';
import { newClientMutationId } from '@/lib/idempotency';
import type { PlanWorkoutDraft } from '@/lib/schemas/plan';

export type UpdatePlanInput = {
  id: string;
  name: string;
  workouts: PlanWorkoutDraft[];
};

export type PlanMutationResponse = {
  id: string;
  name: string;
  shareSlug: string;
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
};

export function useUpdatePlanMutation() {
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation<PlanMutationResponse, Error, UpdatePlanInput>({
    mutationFn: async ({ id, name, workouts }) => {
      const clientMutationId = newClientMutationId();

      const response = await fetch(`/api/plans/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': clientMutationId,
        },
        body: JSON.stringify({ clientMutationId, name, workouts }),
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
    onSuccess: (plan) => {
      void queryClient.invalidateQueries({ queryKey: ['plans'] });
      router.push(`/train/plans/${plan.id}`);
      router.refresh();
    },
    onError: () => {
      toast.error('Failed to save plan. Please try again.');
    },
  });
}
