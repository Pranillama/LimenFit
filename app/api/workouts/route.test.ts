import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/api/auth', () => ({
  requireUser: vi.fn(),
  ApiAuthError: class ApiAuthError extends Error {
    constructor(message = 'Unauthorized') {
      super(message);
      this.name = 'ApiAuthError';
    }
  },
}));

vi.mock('@/lib/idempotency/server', () => ({
  withIdempotency: vi.fn(),
  IdempotencyValidationError: class IdempotencyValidationError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'IdempotencyValidationError';
    }
  },
}));

import { POST } from './route';
import { requireUser } from '@/lib/api/auth';
import { withIdempotency } from '@/lib/idempotency/server';

const mockRequireUser = vi.mocked(requireUser);
const mockWithIdempotency = vi.mocked(withIdempotency);

const CLIENT_MUTATION_ID = '550e8400-e29b-41d4-a716-446655440000';
const LOCAL_ID = '550e8400-e29b-41d4-a716-446655440099';
const USER_ID = 'user-123';

type WorkoutRow = {
  id: string;
  name: string | null;
  started_at: string;
  last_activity_at: string;
  plan_workout_id: string | null;
};

function makeRequest(): Request {
  return new Request('http://localhost/api/workouts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      clientMutationId: CLIENT_MUTATION_ID,
      localId: LOCAL_ID,
      name: null,
      planWorkoutId: null,
      originPlanWorkoutId: null,
      startedAt: '2026-05-01T10:00:00.000Z',
      lastActivityAt: '2026-05-01T10:00:00.000Z',
    }),
  });
}

function makeSupabase(workoutRow: WorkoutRow | null): any {
  return {
    from: (table: string) => {
      if (table === 'workouts') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: async () => ({ data: workoutRow, error: null }),
              }),
            }),
          }),
        };
      }
      return {};
    },
  };
}

describe('POST /api/workouts — create draft (idempotency scenarios)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Scenario 1: First call finds existing draft', () => {
    it('returns 200 with alreadyExisted: true and existingDraft', async () => {
      mockRequireUser.mockResolvedValueOnce({
        supabase: makeSupabase(null) as any,
        user: { id: USER_ID } as any,
      });
      mockWithIdempotency.mockResolvedValueOnce({
        replayed: false,
        resourceId: 'wk-001',
        response: {
          id: 'wk-001',
          clientMutationId: CLIENT_MUTATION_ID,
          alreadyExisted: true,
          existingDraft: {
            id: 'wk-001',
            name: 'My Workout',
            startedAt: '2026-05-01T10:00:00.000Z',
            lastActivityAt: '2026-05-01T10:30:00.000Z',
            planWorkoutId: null,
          },
        } as any,
      });

      const res = await POST(makeRequest());
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.alreadyExisted).toBe(true);
      expect(json.existingDraft).toBeDefined();
      expect(json.existingDraft.id).toBe('wk-001');
      expect(mockWithIdempotency).toHaveBeenCalledWith(
        expect.objectContaining({ mutationType: 'workout.create' }),
      );
    });
  });

  describe('Scenario 2: Replay of existing-draft create', () => {
    it('preserves alreadyExisted: true and existingDraft from stored metadata', async () => {
      const workoutRow: WorkoutRow = {
        id: 'wk-001',
        name: 'My Workout',
        started_at: '2026-05-01T10:00:00.000Z',
        last_activity_at: '2026-05-01T10:30:00.000Z',
        plan_workout_id: null,
      };
      mockRequireUser.mockResolvedValueOnce({
        supabase: makeSupabase(workoutRow) as any,
        user: { id: USER_ID } as any,
      });
      mockWithIdempotency.mockResolvedValueOnce({
        replayed: true,
        resourceId: 'wk-001',
        response: null,
        responseMetadata: { alreadyExisted: true },
        mutationType: 'workout.create',
      });

      const res = await POST(makeRequest());
      const json = await res.json();

      expect(res.status).toBe(200);
      // Must read alreadyExisted from stored metadata, not hard-code false
      expect(json.alreadyExisted).toBe(true);
      expect(json.alreadyExisted).not.toBe(false);
      expect(json.existingDraft).toBeDefined();
      expect(json.existingDraft.id).toBe('wk-001');
    });
  });

  describe('Scenario 3: First call creates new draft', () => {
    it('returns 201 with alreadyExisted: false and existingDraft: null', async () => {
      mockRequireUser.mockResolvedValueOnce({
        supabase: makeSupabase(null) as any,
        user: { id: USER_ID } as any,
      });
      mockWithIdempotency.mockResolvedValueOnce({
        replayed: false,
        resourceId: 'wk-002',
        response: {
          id: 'wk-002',
          clientMutationId: CLIENT_MUTATION_ID,
          alreadyExisted: false,
          existingDraft: null,
          name: null,
          startedAt: '2026-05-01T10:00:00.000Z',
          lastActivityAt: '2026-05-01T10:00:00.000Z',
          planWorkoutId: null,
        } as any,
      });

      const res = await POST(makeRequest());
      const json = await res.json();

      expect(res.status).toBe(201);
      expect(json.alreadyExisted).toBe(false);
      expect(json.existingDraft).toBeNull();
      // mutation_type must be the logical name, not outcome-specific
      const callArgs = mockWithIdempotency.mock.calls[0]![0];
      expect(callArgs.mutationType).toBe('workout.create');
      expect(callArgs.mutationType).not.toContain('existed');
    });
  });

  describe('Scenario 4: Replay of insert create', () => {
    it('preserves alreadyExisted: false from stored metadata', async () => {
      const workoutRow: WorkoutRow = {
        id: 'wk-002',
        name: null,
        started_at: '2026-05-01T10:00:00.000Z',
        last_activity_at: '2026-05-01T10:00:00.000Z',
        plan_workout_id: null,
      };
      mockRequireUser.mockResolvedValueOnce({
        supabase: makeSupabase(workoutRow) as any,
        user: { id: USER_ID } as any,
      });
      mockWithIdempotency.mockResolvedValueOnce({
        replayed: true,
        resourceId: 'wk-002',
        response: null,
        responseMetadata: { alreadyExisted: false },
        mutationType: 'workout.create',
      });

      const res = await POST(makeRequest());
      const json = await res.json();

      expect(res.status).toBe(200);
      // Must read alreadyExisted from stored metadata, not hard-code false
      expect(json.alreadyExisted).toBe(false);
      expect(json.existingDraft).toBeNull();
    });
  });
});
