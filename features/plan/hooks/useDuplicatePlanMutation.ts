'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';

import type { PlanMutationResponse } from './useCreatePlanMutation';

export type DuplicatePlanInput = {
  shareSlug: string;
  clientMutationId: string;
};

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function useDuplicatePlanMutation() {
  const queryClient = useQueryClient();

  return useMutation<PlanMutationResponse, ApiError, DuplicatePlanInput>({
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
        let code: string | undefined;
        try {
          const body = (await response.json()) as { error?: { message?: string; code?: string } };
          if (body.error?.message) message = body.error.message;
          if (body.error?.code) code = body.error.code;
        } catch {
          // ignore parse errors
        }
        throw new ApiError(message, response.status, code);
      }

      return response.json() as Promise<PlanMutationResponse>;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['plans'] });
    },
  });
}
