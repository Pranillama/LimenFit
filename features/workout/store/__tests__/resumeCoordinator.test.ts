import { describe, it, expect, vi, afterEach } from 'vitest';

// Mock useActiveWorkoutStore before importing the coordinator so the module-level
// call to useActiveWorkoutStore.getState() is fully controlled by each test.
vi.mock('../useActiveWorkoutStore', () => ({
  useActiveWorkoutStore: {
    getState: vi.fn(),
  },
}));

import { useActiveWorkoutStore } from '../useActiveWorkoutStore';
import type { StartDecision, StartIntent } from '../resumeCoordinator';

const mockGetState = vi.mocked(useActiveWorkoutStore.getState);

// Dynamic import so the vi.mock above is applied before the coordinator module loads.
const { requestStartWorkout, subscribeResumeRequest, settleRequest } =
  await import('../resumeCoordinator');

// Minimal state shapes that satisfy selectHasActiveDraft.
function stateWithDraft() {
  return { meta: { localId: 'draft-1', status: 'in_progress' } } as ReturnType<
    typeof useActiveWorkoutStore.getState
  >;
}

function stateNoDraft() {
  return { meta: null } as ReturnType<typeof useActiveWorkoutStore.getState>;
}

function stateWithCompletedLocal() {
  return {
    meta: { localId: 'workout-1', status: 'completed_local', workoutId: 'server-1' },
  } as ReturnType<typeof useActiveWorkoutStore.getState>;
}

function stateWithCompletedSynced() {
  return {
    meta: { localId: 'workout-1', status: 'completed_synced', workoutId: 'server-1' },
  } as ReturnType<typeof useActiveWorkoutStore.getState>;
}

describe('resumeCoordinator', () => {
  let unsubscribe: (() => void) | undefined;

  afterEach(() => {
    // Reset module-level singleton state between tests.
    settleRequest('cancel');
    unsubscribe?.();
    unsubscribe = undefined;
  });

  // ─── Basic contract ───────────────────────────────────────────────────────

  it('resolves immediately as discard-and-start when no active draft exists', async () => {
    mockGetState.mockReturnValue(stateNoDraft());
    const decision = await requestStartWorkout({ source: 'home' });
    expect(decision).toBe('discard-and-start');
  });

  it('resolves immediately as sync-in-progress when store is in completed_local (protected state)', async () => {
    mockGetState.mockReturnValue(stateWithCompletedLocal());
    const decision = await requestStartWorkout({ source: 'home' });
    expect(decision).toBe('sync-in-progress');
  });

  it('resolves immediately as discard-and-start when store holds a completed_synced summary', async () => {
    mockGetState.mockReturnValue(stateWithCompletedSynced());
    const decision = await requestStartWorkout({ source: 'history' });
    expect(decision).toBe('discard-and-start');
  });

  it('emits to the handler and awaits settlement when an active draft exists', async () => {
    mockGetState.mockReturnValue(stateWithDraft());
    const captured: Array<{ intent: StartIntent }> = [];
    unsubscribe = subscribeResumeRequest((req) => captured.push(req));

    const p = requestStartWorkout({ source: 'home' });
    settleRequest('resume');
    expect(await p).toBe('resume');
    expect(captured).toHaveLength(1);
    expect(captured[0]!.intent.source).toBe('home');
  });

  it('resolves cancel when no handler is mounted (prevents promise hanging)', async () => {
    mockGetState.mockReturnValue(stateWithDraft());
    // No subscribeResumeRequest call — simulates dialog not yet mounted.
    const decision = await requestStartWorkout({ source: 'freestyle' });
    expect(decision).toBe('cancel');
  });

  // ─── Concurrent call regression ───────────────────────────────────────────

  describe('concurrent call policy — duplicate requests resolve as cancel', () => {
    it('resolves later caller as cancel while owner awaits dialog — different intents', async () => {
      mockGetState.mockReturnValue(stateWithDraft());
      const handlerCalls: StartIntent[] = [];
      unsubscribe = subscribeResumeRequest((req) => handlerCalls.push(req.intent));

      // Owner request — opens the dialog.
      const p1 = requestStartWorkout({ source: 'home' });
      // Competing request with different intent — dialog is already open.
      const p2 = requestStartWorkout({ source: 'plan', payload: { planWorkoutId: 'plan-abc' } });

      // User sees only the owner's dialog and chooses discard-and-start.
      settleRequest('discard-and-start');

      const [d1, d2] = await Promise.all([p1, p2]);

      // Owner receives the real decision.
      expect(d1).toBe('discard-and-start');
      // Concurrent caller is cancelled — its intent was never presented to the user.
      expect(d2).toBe('cancel');
      // Handler was invoked exactly once, for the owner intent only.
      expect(handlerCalls).toHaveLength(1);
      expect(handlerCalls[0]!.source).toBe('home');
    });

    it('rapid double-click of the same entry point — only the first start path runs', async () => {
      mockGetState.mockReturnValue(stateWithDraft());
      const handlerCalls: StartIntent[] = [];
      unsubscribe = subscribeResumeRequest((req) => handlerCalls.push(req.intent));

      const p1 = requestStartWorkout({ source: 'freestyle' });
      const p2 = requestStartWorkout({ source: 'freestyle' });
      const p3 = requestStartWorkout({ source: 'freestyle' });

      settleRequest('discard-and-start');

      const results: StartDecision[] = await Promise.all([p1, p2, p3]);
      expect(results[0]).toBe('discard-and-start');
      expect(results[1]).toBe('cancel');
      expect(results[2]).toBe('cancel');
      // Dialog handler fired only once — one draft start path, one confirmed intent.
      expect(handlerCalls).toHaveLength(1);
    });

    it('second request can open a new dialog after the first request is settled', async () => {
      mockGetState.mockReturnValue(stateWithDraft());
      unsubscribe = subscribeResumeRequest(() => {});

      // First dialog cycle.
      const p1 = requestStartWorkout({ source: 'home' });
      settleRequest('cancel');
      expect(await p1).toBe('cancel');

      // After settlement, a new request should open fresh.
      const p2 = requestStartWorkout({ source: 'plan', payload: { planWorkoutId: 'plan-1' } });
      settleRequest('discard-and-start');
      expect(await p2).toBe('discard-and-start');
    });
  });
});
