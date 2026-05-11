'use client';

import { useMutation } from '@tanstack/react-query';

import { toast } from 'sonner';

import { useActiveWorkoutStore } from '@/features/workout/store/useActiveWorkoutStore';
import type { UserSettings } from '@/features/workout/store/types';

export function useUpdateSettingsMutation() {
  return useMutation<UserSettings, Error, Partial<UserSettings>, { previous: UserSettings }>({
    mutationFn: async (patch) => {
      const response = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
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

      return (await response.json()) as UserSettings;
    },
    onMutate: (patch) => {
      const previous = useActiveWorkoutStore.getState().settings;
      useActiveWorkoutStore.getState().setUserSettings(patch);
      return { previous };
    },
    onSuccess: (canonical) => {
      useActiveWorkoutStore.getState().setUserSettings(canonical);
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) {
        useActiveWorkoutStore.getState().setUserSettings(ctx.previous);
      }
      toast.error('Failed to update settings');
    },
  });
}
