import { describe, it, expect, vi, beforeEach } from 'vitest';

// Hoist all vi.mock calls before any imports so module-level side effects
// of browser-only modules do not run in the node test environment.

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
}));

vi.mock('@/components/ui/sonner', () => ({
  toast: { error: vi.fn() },
}));

vi.mock('../../store/useActiveWorkoutStore', () => ({
  useActiveWorkoutStore: {
    getState: vi.fn(),
  },
}));

vi.mock('../../store/resumeCoordinator', () => ({
  requestStartWorkout: vi.fn(),
}));

vi.mock('../../store/selectors', () => ({
  selectHasActiveDraft: vi.fn(),
  selectIsCompletedLocalProtected: vi.fn(),
}));

import { useRouter } from 'next/navigation';
import { useActiveWorkoutStore } from '../../store/useActiveWorkoutStore';
import { requestStartWorkout } from '../../store/resumeCoordinator';
import { selectHasActiveDraft, selectIsCompletedLocalProtected } from '../../store/selectors';

const mockPush = vi.fn();
const mockUseRouter = vi.mocked(useRouter);
const mockGetState = vi.mocked(useActiveWorkoutStore.getState);
const mockRequestStartWorkout = vi.mocked(requestStartWorkout);
const mockSelectHasActiveDraft = vi.mocked(selectHasActiveDraft);
const mockSelectIsCompletedLocalProtected = vi.mocked(selectIsCompletedLocalProtected);

// Dynamic import ensures all vi.mock factories above are applied first.
const { useStartWorkoutAction } = await import('../useStartWorkoutAction');

describe('useStartWorkoutAction — discard-and-start branch', () => {
  let mockStartDraft: ReturnType<typeof vi.fn>;
  let mockDiscardDraft: ReturnType<typeof vi.fn>;
  let mockClearCompletedSession: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockStartDraft = vi.fn();
    mockDiscardDraft = vi.fn();
    mockClearCompletedSession = vi.fn();
    mockUseRouter.mockReturnValue({ push: mockPush } as unknown as ReturnType<typeof useRouter>);
    mockRequestStartWorkout.mockResolvedValue('discard-and-start');
  });

  function makeState(status: string | null, workoutId: string | null = 'server-id-1') {
    const meta = status !== null ? { status, workoutId, localId: 'local-1' } : null;
    return {
      meta,
      startDraft: mockStartDraft,
      discardDraft: mockDiscardDraft,
      clearCompletedSession: mockClearCompletedSession,
    } as unknown as ReturnType<typeof useActiveWorkoutStore.getState>;
  }

  // ─── completed_local: clearCompletedSession is used, discardDraft is not ─────

  it('calls clearCompletedSession (not discardDraft) for completed_local on home intent', async () => {
    mockGetState.mockReturnValue(makeState('completed_local'));
    const startWorkout = useStartWorkoutAction();
    await startWorkout({ source: 'home' });
    expect(mockClearCompletedSession).toHaveBeenCalledOnce();
    expect(mockDiscardDraft).not.toHaveBeenCalled();
    expect(mockStartDraft).toHaveBeenCalledOnce();
    expect(mockPush).toHaveBeenCalledWith('/train');
  });

  it('calls clearCompletedSession (not discardDraft) for completed_local on history intent', async () => {
    mockGetState.mockReturnValue(makeState('completed_local'));
    const startWorkout = useStartWorkoutAction();
    await startWorkout({ source: 'history' });
    expect(mockClearCompletedSession).toHaveBeenCalledOnce();
    expect(mockDiscardDraft).not.toHaveBeenCalled();
    expect(mockStartDraft).toHaveBeenCalledOnce();
  });

  it('calls clearCompletedSession (not discardDraft) for completed_local on plan intent', async () => {
    mockGetState.mockReturnValue(makeState('completed_local'));
    const startWorkout = useStartWorkoutAction();
    await startWorkout({ source: 'plan', payload: { planWorkoutId: 'plan-abc' } });
    expect(mockClearCompletedSession).toHaveBeenCalledOnce();
    expect(mockDiscardDraft).not.toHaveBeenCalled();
    expect(mockStartDraft).toHaveBeenCalledWith({
      planWorkoutId: 'plan-abc',
      name: undefined,
      exercises: undefined,
    });
  });

  // ─── completed_synced: same protection applies ────────────────────────────────

  it('calls clearCompletedSession (not discardDraft) for completed_synced on home intent', async () => {
    mockGetState.mockReturnValue(makeState('completed_synced'));
    const startWorkout = useStartWorkoutAction();
    await startWorkout({ source: 'home' });
    expect(mockClearCompletedSession).toHaveBeenCalledOnce();
    expect(mockDiscardDraft).not.toHaveBeenCalled();
    expect(mockStartDraft).toHaveBeenCalledOnce();
  });

  // ─── in_progress draft: existing discard path is preserved ───────────────────

  it('calls discardDraft (not clearCompletedSession) for a true in_progress draft', async () => {
    mockGetState.mockReturnValue(makeState('in_progress', null));
    const startWorkout = useStartWorkoutAction();
    await startWorkout({ source: 'home' });
    expect(mockDiscardDraft).toHaveBeenCalledOnce();
    expect(mockClearCompletedSession).not.toHaveBeenCalled();
    expect(mockStartDraft).toHaveBeenCalledOnce();
    expect(mockPush).toHaveBeenCalledWith('/train');
  });

  it('calls discardDraft (not clearCompletedSession) for in_progress draft on plan intent', async () => {
    mockGetState.mockReturnValue(makeState('in_progress', 'server-id-1'));
    const startWorkout = useStartWorkoutAction();
    await startWorkout({
      source: 'plan',
      payload: { planWorkoutId: 'plan-xyz', planWorkoutName: 'Leg Day' },
    });
    expect(mockDiscardDraft).toHaveBeenCalledOnce();
    expect(mockClearCompletedSession).not.toHaveBeenCalled();
    expect(mockStartDraft).toHaveBeenCalledWith({
      planWorkoutId: 'plan-xyz',
      name: 'Leg Day',
      exercises: undefined,
    });
  });

  // ─── empty store (meta === null): existing behavior preserved ─────────────────

  it('calls discardDraft and startDraft when store is empty (meta === null)', async () => {
    mockGetState.mockReturnValue(makeState(null));
    const startWorkout = useStartWorkoutAction();
    await startWorkout({ source: 'home' });
    expect(mockDiscardDraft).toHaveBeenCalledOnce();
    expect(mockClearCompletedSession).not.toHaveBeenCalled();
    expect(mockStartDraft).toHaveBeenCalledOnce();
  });
});

describe('useStartWorkoutAction — history-restore branch', () => {
  const mockHydrateFromServer = vi.fn();

  const fakeSnapshot = {
    meta: {
      workoutId: 'server-1',
      localId: 'local-1',
      name: 'Old Lift',
      status: 'in_progress' as const,
      startedAt: '2026-01-01T10:00:00Z',
      lastActivityAt: '2026-01-01T10:00:00Z',
      planWorkoutId: null,
      originPlanWorkoutId: null,
    },
    exercises: [],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockHydrateFromServer.mockReset();
    mockUseRouter.mockReturnValue({ push: mockPush } as unknown as ReturnType<typeof useRouter>);
    mockGetState.mockReturnValue({
      hydrateFromServer: mockHydrateFromServer,
    } as unknown as ReturnType<typeof useActiveWorkoutStore.getState>);
  });

  it('returns blocked sync-in-progress and does not hydrate when store is in completed_local', async () => {
    mockSelectHasActiveDraft.mockReturnValue(false);
    mockSelectIsCompletedLocalProtected.mockReturnValue(true);

    const startWorkout = useStartWorkoutAction();
    const result = await startWorkout({
      source: 'history-restore',
      payload: { snapshot: fakeSnapshot },
    });

    expect(result).toEqual({ blocked: true, reason: 'sync-in-progress' });
    expect(mockHydrateFromServer).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('returns blocked active-draft-exists and does not hydrate when an active draft exists', async () => {
    mockSelectHasActiveDraft.mockReturnValue(true);
    mockSelectIsCompletedLocalProtected.mockReturnValue(false);

    const startWorkout = useStartWorkoutAction();
    const result = await startWorkout({
      source: 'history-restore',
      payload: { snapshot: fakeSnapshot },
    });

    expect(result).toEqual({ blocked: true, reason: 'active-draft-exists' });
    expect(mockHydrateFromServer).not.toHaveBeenCalled();
  });

  it('hydrates and navigates when store is clear', async () => {
    mockSelectHasActiveDraft.mockReturnValue(false);
    mockSelectIsCompletedLocalProtected.mockReturnValue(false);

    const startWorkout = useStartWorkoutAction();
    await startWorkout({ source: 'history-restore', payload: { snapshot: fakeSnapshot } });

    expect(mockHydrateFromServer).toHaveBeenCalledWith(fakeSnapshot);
    expect(mockPush).toHaveBeenCalledWith('/train');
  });
});
