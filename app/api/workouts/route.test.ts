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

  describe('Scenarios 1 & 2: Two calls with same clientMutationId on existing draft', () => {
    it('returns 200 alreadyExisted: true on both calls; insert is never called', async () => {
      const WORKOUT_ROW: WorkoutRow = {
        id: 'wk-001',
        name: 'My Workout',
        started_at: '2026-05-01T10:00:00.000Z',
        last_activity_at: '2026-05-01T10:30:00.000Z',
        plan_workout_id: null,
      };

      const insertSpy = vi.fn();
      const supabase: any = {
        from: (table: string) => {
          if (table !== 'workouts') return {};
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  maybeSingle: async () => ({ data: WORKOUT_ROW, error: null }),
                }),
              }),
            }),
            insert: insertSpy,
          };
        },
      };

      mockRequireUser.mockResolvedValue({
        supabase,
        user: { id: USER_ID } as any,
      });

      let capturedResult: {
        resourceId: string | null;
        response: any;
        responseMetadata?: any;
      } | null = null;
      mockWithIdempotency.mockImplementation(async (opts: any) => {
        if (capturedResult === null) {
          const r = await opts.handler();
          capturedResult = r;
          return { replayed: false, resourceId: r.resourceId, response: r.response };
        }
        return {
          replayed: true,
          resourceId: capturedResult.resourceId,
          responseMetadata: capturedResult.responseMetadata,
          response: null,
        };
      });

      const res1 = await POST(makeRequest());
      const json1 = await res1.json();

      const res2 = await POST(makeRequest());
      const json2 = await res2.json();

      expect(res1.status).toBe(200);
      expect(res2.status).toBe(200);
      expect(insertSpy).not.toHaveBeenCalled();
      expect(json1.alreadyExisted).toBe(true);
      expect(json1.existingDraft).toBeDefined();
      expect(json1.existingDraft.id).toBe('wk-001');
      expect(json2).toEqual(json1);
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

  describe('Scenario 5: Two calls with same clientMutationId insert once', () => {
    it('inserts once and returns the same id, clientMutationId, and alreadyExisted on both calls', async () => {
      const WORKOUT_ROW = {
        id: 'wk-new',
        name: null,
        started_at: '2026-05-01T10:00:00.000Z',
        last_activity_at: '2026-05-01T10:00:00.000Z',
        plan_workout_id: null,
      };

      const insertSpy = vi.fn().mockReturnValue({
        select: () => ({
          single: async () => ({ data: WORKOUT_ROW, error: null }),
        }),
      });

      let maybeSingleCalls = 0;
      const supabase: any = {
        from: (table: string) => {
          if (table !== 'workouts') return {};
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  maybeSingle: async () => {
                    maybeSingleCalls++;
                    // First call: handler checking for an existing in-progress draft
                    if (maybeSingleCalls === 1) return { data: null, error: null };
                    // Second call: replay path re-fetching the row by resourceId
                    return { data: WORKOUT_ROW, error: null };
                  },
                }),
              }),
            }),
            insert: insertSpy,
          };
        },
      };

      mockRequireUser.mockResolvedValue({
        supabase,
        user: { id: USER_ID } as any,
      });

      let capturedResult: {
        resourceId: string | null;
        response: any;
        responseMetadata?: any;
      } | null = null;
      mockWithIdempotency.mockImplementation(async (opts: any) => {
        if (capturedResult === null) {
          const r = await opts.handler();
          capturedResult = r;
          return { replayed: false, resourceId: r.resourceId, response: r.response };
        }
        return {
          replayed: true,
          resourceId: capturedResult.resourceId,
          responseMetadata: capturedResult.responseMetadata,
          response: null,
        };
      });

      const res1 = await POST(makeRequest());
      const json1 = await res1.json();

      const res2 = await POST(makeRequest());
      const json2 = await res2.json();

      expect(insertSpy).toHaveBeenCalledTimes(1);
      expect(json2).toEqual(json1);
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

describe('POST /api/workouts — auth and validation errors', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when requireUser throws ApiAuthError', async () => {
    const { ApiAuthError } = await import('@/lib/api/auth');
    mockRequireUser.mockRejectedValueOnce(new ApiAuthError());

    const res = await POST(makeRequest());

    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 400 VALIDATION_ERROR when body fails schema validation', async () => {
    mockRequireUser.mockResolvedValueOnce({
      supabase: makeSupabase(null) as any,
      user: { id: USER_ID } as any,
    });

    const req = new Request('http://localhost/api/workouts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientMutationId: 'not-a-uuid' }),
    });

    const res = await POST(req);

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error.code).toBe('VALIDATION_ERROR');
    expect(mockWithIdempotency).not.toHaveBeenCalled();
  });
});
