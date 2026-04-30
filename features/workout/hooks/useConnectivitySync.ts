'use client';

import { useEffect, useRef } from 'react';
import { useActiveWorkoutStore } from '../store/useActiveWorkoutStore';
import { flushQueue, cancelPendingRetry, type FlushableStore } from '../store/queue';

/**
 * Builds a FlushableStore adapter over the Zustand bound store, bridging the
 * engine's method-on-store interface with Zustand's method-on-state pattern.
 */
function buildAdapter(): FlushableStore {
  return {
    getState: () => useActiveWorkoutStore.getState(),
    getQueue: () => useActiveWorkoutStore.getState().getQueue(),
    getTombstones: () => useActiveWorkoutStore.getState().getTombstones(),
    clearTombstone: (localId) => useActiveWorkoutStore.getState().clearTombstone(localId),
    applyServerIds: (map) => useActiveWorkoutStore.getState().applyServerIds(map),
    setSyncState: (patch) => useActiveWorkoutStore.getState().setSyncState(patch),
    dropMutation: (id) => useActiveWorkoutStore.getState().dropMutation(id),
    incrementAttempt: (id) => useActiveWorkoutStore.getState().incrementAttempt(id),
    quarantineMutation: (id) => useActiveWorkoutStore.getState().quarantineMutation(id),
    enqueueMutation: (mutation) => useActiveWorkoutStore.getState().enqueueMutation(mutation),
  };
}

/**
 * Attaches connectivity listeners and drives the flush engine.
 *
 * - Syncs navigator.onLine on mount and after hydration.
 * - Triggers a flush when coming online, when the tab foregrounds, and when
 *   the queue grows from empty to non-empty while online.
 * - Cleans up all listeners and any pending backoff timer on unmount.
 *
 * Mount this hook once near the root of the active-workout UI tree.
 */
export function useConnectivitySync(): void {
  const adapterRef = useRef<FlushableStore | null>(null);

  useEffect(() => {
    // Create the adapter once per mount — stable across re-renders.
    if (adapterRef.current === null) {
      adapterRef.current = buildAdapter();
    }
    const adapter = adapterRef.current;

    // Disposed flag: set in cleanup before cancelPendingRetry() so microtasks scheduled
    // before unmount (hydration, queue-growth) can detect they should not flush.
    let disposed = false;

    // Initialise online flag from the browser's current knowledge.
    useActiveWorkoutStore.getState().markOnline(navigator.onLine);

    function triggerFlush(): void {
      if (!disposed && adapter.getState().sync.online) {
        void flushQueue(adapter);
      }
    }

    // --- Online / offline handlers ---

    function handleOnline(): void {
      useActiveWorkoutStore.getState().markOnline(true);
      if (!disposed) void flushQueue(adapter);
    }

    function handleOffline(): void {
      useActiveWorkoutStore.getState().markOnline(false);
    }

    // --- Visibility: retry when the tab comes back to the foreground ---

    function handleVisibilityChange(): void {
      if (document.visibilityState === 'visible') {
        triggerFlush();
      }
    }

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // --- Post-hydration flush: fire once when the persisted store has loaded ---
    // With synchronous localStorage, Zustand can finish hydrating before this effect
    // mounts. Check hasHydrated() and flush immediately in that case; otherwise register
    // for the future callback.

    let unsubHydration: (() => void) | null = null;

    function onHydrated(): void {
      if (disposed) return;
      useActiveWorkoutStore.getState().markOnline(navigator.onLine);
      if (navigator.onLine) {
        void flushQueue(adapter);
      }
    }

    if (useActiveWorkoutStore.persist.hasHydrated()) {
      // Already hydrated — schedule flush in a microtask so this effect finishes first.
      void Promise.resolve().then(onHydrated);
    } else {
      unsubHydration = useActiveWorkoutStore.persist.onFinishHydration(onHydrated);
    }

    // --- Queue-growth subscription: 0→N while online schedules a microtask flush ---

    let prevQueueLength = adapter.getQueue().length;

    const unsubQueue = useActiveWorkoutStore.subscribe((state) => {
      const nextLen = state.queue.length;
      if (prevQueueLength === 0 && nextLen > 0 && state.sync.online) {
        // Microtask so the enqueue has fully committed before the engine reads the queue.
        void Promise.resolve().then(() => {
          if (!disposed) void flushQueue(adapter);
        });
      }
      prevQueueLength = nextLen;
    });

    return () => {
      disposed = true;
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (unsubHydration !== null) unsubHydration();
      unsubQueue();
      cancelPendingRetry();
    };
  }, []); // stable adapter ref; listeners never need re-binding
}
