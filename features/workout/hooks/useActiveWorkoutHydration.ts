'use client';

import { useEffect } from 'react';
import { useActiveWorkoutStore } from '../store/useActiveWorkoutStore';
import { hydrateActiveWorkout } from '../store/hydration';

/**
 * Runs the server hydration pass once on mount and marks the shared store as
 * hydrated when done. Mount this hook exactly once — inside ActiveWorkoutRuntime
 * — not at the page level, so each page doesn't trigger a separate hydration attempt.
 *
 * If the hydration query throws a non-auth error (network, server 5xx), the store
 * stays un-hydrated and retries automatically when the browser comes back online.
 */
export function useActiveWorkoutHydration(): void {
  useEffect(() => {
    let cancelled = false;
    let succeeded = false;

    async function run() {
      if (cancelled || succeeded) return;
      try {
        await hydrateActiveWorkout(useActiveWorkoutStore);
        succeeded = true;
        if (!cancelled) useActiveWorkoutStore.getState().markHydrated();
      } catch {
        // Non-auth network/server error: hydrated stays false.
        // The online listener below will trigger a retry on reconnect.
      }
    }

    void run();

    function handleOnline() {
      void run();
    }

    window.addEventListener('online', handleOnline);
    return () => {
      cancelled = true;
      window.removeEventListener('online', handleOnline);
    };
  }, []);
}
