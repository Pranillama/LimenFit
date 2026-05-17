import { selectHasActiveDraft } from './selectors';
import { useActiveWorkoutStore, type ServerWorkoutSnapshot } from './useActiveWorkoutStore';
import type { PreloadedExercise } from './types';

// ---------- Public types ----------

export type StartDecision = 'resume' | 'discard-and-start' | 'cancel';

/**
 * Discriminated union of start intents. Each source carries only the payload
 * fields that make sense for that entry point, so T10/T12 can safely preload
 * exercises and T7/T10 can provide a restore snapshot.
 */
export type StartIntent =
  | { source: 'home' | 'freestyle'; payload?: undefined }
  | {
      source: 'plan';
      payload: { planWorkoutId: string; planWorkoutName?: string; exercises?: PreloadedExercise[] };
    }
  | { source: 'history'; payload?: { exercises?: PreloadedExercise[] } }
  | { source: 'history-restore'; payload: { snapshot: ServerWorkoutSnapshot } };

// ---------- Internal bus ----------

type PendingRequest = {
  intent: StartIntent;
  resolve: (decision: StartDecision) => void;
  promise: Promise<StartDecision>;
};

type RequestHandler = (request: PendingRequest) => void;

let _handler: RequestHandler | null = null;
let _pending: PendingRequest | null = null;

/**
 * Subscribe to incoming resume-or-discard requests.
 * The dialog mounts once at the shell level and calls this.
 * Returns an unsubscribe function.
 *
 * If a request arrived before the handler mounted (race at startup),
 * it is replayed immediately so the dialog can open.
 */
export function subscribeResumeRequest(handler: RequestHandler): () => void {
  _handler = handler;
  if (_pending) {
    handler(_pending);
  }
  return () => {
    if (_handler === handler) _handler = null;
  };
}

/**
 * Called by the dialog when the user picks an option.
 * Resolves the pending promise and clears module state.
 */
export function settleRequest(decision: StartDecision): void {
  if (_pending) {
    const resolver = _pending.resolve;
    _pending = null;
    resolver(decision);
  }
}

/**
 * Entry point for consumers (T10 / T12 / T14).
 *
 * - No active draft → resolves immediately as 'discard-and-start' (just start).
 * - Active draft present → emits to the dialog subscriber and awaits the user's choice.
 *
 * Concurrent call policy: if a request is already open, later callers receive
 * 'cancel' immediately rather than sharing the owner's promise. This ensures only
 * the request owner can act on the user's dialog decision — duplicate rapid calls
 * (double-clicks, competing entry points) are safely ignored without hanging.
 * A missing dialog handler resolves 'cancel' after a microtask rather than leaving
 * the promise permanently pending.
 */
export function requestStartWorkout(intent: StartIntent): Promise<StartDecision> {
  if (!selectHasActiveDraft(useActiveWorkoutStore.getState())) {
    return Promise.resolve('discard-and-start');
  }

  // Resolve duplicate/concurrent callers as 'cancel' so that only the owner of
  // the pending request can act on the dialog decision. Sharing the promise would
  // allow every concurrent caller to run discard-and-start side effects.
  if (_pending) {
    return Promise.resolve('cancel');
  }

  let resolveRequest!: (decision: StartDecision) => void;
  const promise = new Promise<StartDecision>((resolve) => {
    resolveRequest = resolve;
  });

  _pending = { intent, resolve: resolveRequest, promise };

  if (_handler) {
    _handler(_pending);
  } else {
    // If no handler is mounted yet, resolve 'cancel' after a microtask — matches
    // the documented contract and prevents the promise from hanging forever.
    void Promise.resolve().then(() => {
      if (_pending?.resolve === resolveRequest) {
        const resolver = _pending.resolve;
        _pending = null;
        resolver('cancel');
      }
    });
  }

  return promise;
}
