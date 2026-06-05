'use client';

import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';

import type { ProfileDTO, ProfilePatchBody } from '@/lib/schemas/profile';

export function useUpdateProfileMutation() {
  return useMutation<ProfileDTO, Error, ProfilePatchBody>({
    mutationFn: async (patch) => {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });

      if (!res.ok) {
        let message = `HTTP ${res.status}`;
        try {
          const body = (await res.json()) as { error?: { message?: string } };
          if (body.error?.message) message = body.error.message;
        } catch {
          // ignore parse errors
        }
        throw new Error(message);
      }

      return (await res.json()) as ProfileDTO;
    },
    onSuccess: () => {
      toast.success('Profile saved');
    },
    onError: () => {
      toast.error('Failed to save profile');
    },
  });
}
