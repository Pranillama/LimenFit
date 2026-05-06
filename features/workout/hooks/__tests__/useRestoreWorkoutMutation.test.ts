import { describe, it, expect, vi, beforeEach } from 'vitest';

// Hoist all vi.mock calls before any imports so module-level side effects
// of React/browser-only modules do not run in the node test environment.

vi.mock('@tanstack/react-query', () => ({
  useMutation: vi.fn(() => ({})),
  useQueryClient: vi.fn(() => ({})),
}));

vi.mock('@/components/ui/sonner', () => ({
  toast: { error: vi.fn() },
}));

vi.mock('@/lib/supabase', () => ({
  createSupabaseBrowserClient: vi.fn(),
}));

vi.mock('../useStartWorkoutAction', () => ({
  useStartWorkoutAction: vi.fn(),
}));

vi.mock('../../store/useActiveWorkoutStore', () => ({
  useActiveWorkoutStore: {
    getState: vi.fn(),
  },
}));

import { useActiveWorkoutStore } from '../../store/useActiveWorkoutStore';

const mockGetState = vi.mocked(useActiveWorkoutStore.getState);

// Dynamic import ensures all vi.mock factories above are applied first.
const { runRestoreMutation } = await import('../useRestoreWorkoutMutation');

describe('runRestoreMutation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('throws RestoreConflictError and does not call fetch when an active local draft exists', async () => {
    mockGetState.mockReturnValue(
      { meta: { localId: 'draft-1' } } as ReturnType<typeof useActiveWorkoutStore.getState>,
    );
    const fetchSpy = vi.fn();
    const startWorkout = vi.fn();

    await expect(
      runRestoreMutation('workout-123', startWorkout, fetchSpy),
    ).rejects.toMatchObject({ name: 'RestoreConflictError', message: 'active-draft-exists' });

    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
