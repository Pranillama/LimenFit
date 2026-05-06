'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';

import { toast } from '@/components/ui/sonner';
import { newClientMutationId } from '@/lib/idempotency';

type EditSetInput = {
  id: string;
  reps?: number;
  weightValue?: number;
};

export function useEditSetMutation() {
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation<void, Error, EditSetInput>({
    mutationFn: async ({ id, reps, weightValue }) => {
      const clientMutationId = newClientMutationId();

      const response = await fetch(`/api/sets/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientMutationId,
          ...(reps !== undefined && { reps }),
          ...(weightValue !== undefined && { weightValue }),
        }),
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
      void queryClient.invalidateQueries({ queryKey: ['workout-detail'] });
      router.refresh();
    },
    onError: () => {
      toast.error('Failed to save edit');
    },
  });
}
