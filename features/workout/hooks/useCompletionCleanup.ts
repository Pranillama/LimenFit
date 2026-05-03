'use client';

import { useEffect } from 'react';
import { useActiveWorkoutStore } from '../store/useActiveWorkoutStore';
import { selectShouldAutoClear } from '../store/selectors';

/**
 * Subscribes to the active workout store and calls clearCompletedSession()
 * as soon as selectShouldAutoClear becomes true (status is completed_synced,
 * queue drained, flush idle). Mount once from ActiveWorkoutRuntime.
 */
export function useCompletionCleanup(): void {
  useEffect(() => {
    return useActiveWorkoutStore.subscribe((state) => {
      if (selectShouldAutoClear(state)) {
        useActiveWorkoutStore.getState().clearCompletedSession();
      }
    });
  }, []);
}
