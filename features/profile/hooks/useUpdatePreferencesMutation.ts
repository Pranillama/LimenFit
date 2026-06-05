'use client';

import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';

import { useActiveWorkoutStore } from '@/features/workout/store/useActiveWorkoutStore';
import type { UserSettingsDTO } from '@/lib/schemas/settings';

type PreferencesPatch = {
  weightUnit?: 'lbs' | 'kg';
  heightUnit?: 'ft' | 'cm';
  restTimerDefaultSeconds?: number;
};

export function useUpdatePreferencesMutation() {
  return useMutation<UserSettingsDTO, Error, PreferencesPatch>({
    mutationFn: async (patch) => {
      const res = await fetch('/api/settings', {
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
      return (await res.json()) as UserSettingsDTO;
    },
    onSuccess: (data) => {
      useActiveWorkoutStore.getState().setUserSettings({
        weightUnit: data.weightUnit,
        restTimerDefaultSeconds: data.restTimerDefaultSeconds,
      });
      toast.success('Preferences saved');
    },
    onError: () => {
      toast.error('Failed to save preferences');
    },
  });
}
