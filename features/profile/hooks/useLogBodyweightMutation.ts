'use client';

import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';

import type { BodyweightEntryDTO } from '@/lib/schemas/body-metrics';

export function useLogBodyweightMutation() {
  return useMutation<BodyweightEntryDTO, Error, { weightKg: number }>({
    mutationFn: async (body) => {
      const res = await fetch('/api/bodyweight', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        let message = `HTTP ${res.status}`;
        try {
          const json = (await res.json()) as { error?: { message?: string } };
          if (json.error?.message) message = json.error.message;
        } catch {
          // ignore parse errors
        }
        throw new Error(message);
      }

      return (await res.json()) as BodyweightEntryDTO;
    },
    onSuccess: () => {
      toast.success('Weight logged');
    },
    onError: () => {
      toast.error('Failed to log weight');
    },
  });
}
