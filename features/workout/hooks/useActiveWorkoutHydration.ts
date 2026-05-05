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
 * falls back to local state and is still marked hydrated so the UI can render.
 * When the browser comes back online, the server fetch is retried automatically.
 */
export function useActiveWorkoutHydration(): void {
  useEffect(() => {
    let cancelled = false;
    let serverFetchDone = false;

    async function run() {
      if (cancelled || serverFetchDone) return;
      try {
        await hydrateActiveWorkout(useActiveWorkoutStore);
      } catch {
        // Non-auth network/server error: proceed with local state.
      } finally {
        serverFetchDone = true;
        if (!cancelled) useActiveWorkoutStore.getState().markHydrated();
      }
    }

    void run();

    function handleOnline() {
      // Retry the server fetch on reconnect (resets serverFetchDone to allow re-run).
      serverFetchDone = false;
      void run();
    }

    window.addEventListener('online', handleOnline);
    return () => {
      cancelled = true;
      window.removeEventListener('online', handleOnline);
    };
  }, []);
}
