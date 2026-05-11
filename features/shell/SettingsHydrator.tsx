'use client';

// The server snapshot is the source of truth on every navigation — it intentionally
// overwrites any stale persisted client value, since the server is authoritative for settings.

import { useEffect } from 'react';

import type { UserSettingsDTO } from '@/lib/schemas/settings';
import { useActiveWorkoutStore } from '@/features/workout/store/useActiveWorkoutStore';

interface SettingsHydratorProps {
  initial: UserSettingsDTO;
}

export function SettingsHydrator({ initial }: SettingsHydratorProps) {
  useEffect(() => {
    if (useActiveWorkoutStore.persist.hasHydrated()) {
      useActiveWorkoutStore.getState().setUserSettings(initial);
    } else {
      const unsub = useActiveWorkoutStore.persist.onFinishHydration(() => {
        useActiveWorkoutStore.getState().setUserSettings(initial);
        unsub();
      });
      return unsub;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial.weightUnit, initial.restTimerDefaultSeconds]);

  return null;
}
