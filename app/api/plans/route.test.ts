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
const PLAN_ID = '660e8400-e29b-41d4-a716-446655440000';
const USER_ID = 'user-aaa0-0000-0000-000000000000';
const EXERCISE_ID = '770e8400-e29b-41d4-a716-446655440000';

const FULL_PLAN_ROW = {
  id: PLAN_ID,
  name: 'Push/Pull/Legs',
  share_slug: 'ppl-abc123',
  is_public: false,
  created_at: '2026-05-07T00:00:00.000Z',
  updated_at: '2026-05-07T00:00:00.000Z',
  plan_workouts: [
    {
      id: 'pw-001',
      name: 'Push Day',
      position: 0,
      plan_exercises: [
        {
          id: 'pe-001',
          exercise_id: EXERCISE_ID,
          target_sets: 3,
          target_reps: 10,
          position: 0,
        },
      ],
    },
  ],
};

const EXPECTED_PLAN_RESPONSE = {
  id: PLAN_ID,
  clientMutationId: CLIENT_MUTATION_ID,
  name: 'Push/Pull/Legs',
  shareSlug: 'ppl-abc123',
  isPublic: false,
  createdAt: '2026-05-07T00:00:00.000Z',
  updatedAt: '2026-05-07T00:00:00.000Z',
  workouts: [
    {
      id: 'pw-001',
      name: 'Push Day',
      position: 0,
      exercises: [
        {
          id: 'pe-001',
          exerciseId: EXERCISE_ID,
          targetSets: 3,
          targetReps: 10,
          position: 0,
        },
      ],
    },
  ],
};

function makeRequest(): Request {
  return new Request('http://localhost/api/plans', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      clientMutationId: CLIENT_MUTATION_ID,
      name: 'Push/Pull/Legs',
      workouts: [
        {
          name: 'Push Day',
          position: 0,
          exercises: [
            { exerciseId: EXERCISE_ID, targetSets: 3, targetReps: 10, position: 0 },
          ],
        },
      ],
    }),
  });
}

function makeSelectBuilder(data: any) {
  return {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({ data, error: null }),
        }),
      }),
    }),
  };
}

describe('POST /api/plans', () => {
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
      supabase: {} as any,
      user: { id: USER_ID } as any,
    });

    const req = new Request('http://localhost/api/plans', {
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

  it('returns 201 with nested plan shape on first create', async () => {
    mockRequireUser.mockResolvedValueOnce({
      supabase: {} as any,
      user: { id: USER_ID } as any,
    });
    mockWithIdempotency.mockResolvedValueOnce({
      replayed: false,
      resourceId: PLAN_ID,
      response: EXPECTED_PLAN_RESPONSE,
    });

    const res = await POST(makeRequest());
    const json = await res.json();

    expect(res.status).toBe(201);
    expect(json.id).toBe(PLAN_ID);
    expect(json.clientMutationId).toBe(CLIENT_MUTATION_ID);
    expect(json.shareSlug).toBe('ppl-abc123');
    expect(json.isPublic).toBe(false);
    expect(json.workouts).toHaveLength(1);
    expect(json.workouts[0].exercises).toHaveLength(1);
    expect(json.workouts[0].exercises[0].exerciseId).toBe(EXERCISE_ID);
    expect(json.workouts[0].exercises[0].targetSets).toBe(3);
    expect(json.workouts[0].exercises[0].targetReps).toBe(10);

    const callArgs = mockWithIdempotency.mock.calls[0]![0];
    expect(callArgs.mutationType).toBe('plan.create');
    expect(callArgs.resourceType).toBe('plans');
  });

  it('returns 200 with same shape on idempotent replay', async () => {
    const supabase: any = {
      from: vi.fn().mockReturnValue(makeSelectBuilder(FULL_PLAN_ROW)),
    };

    mockRequireUser.mockResolvedValueOnce({ supabase, user: { id: USER_ID } as any });
    mockWithIdempotency.mockResolvedValueOnce({
      replayed: true,
      resourceId: PLAN_ID,
      response: null,
    });

    const res = await POST(makeRequest());
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toEqual(EXPECTED_PLAN_RESPONSE);
  });

  it('converges on existing row when RPC raises 23505', async () => {
    let fromCallCount = 0;
    const supabase: any = {
      rpc: vi.fn().mockResolvedValue({
        data: null,
        error: { code: '23505', message: 'duplicate key value' },
      }),
      from: vi.fn().mockImplementation(() => {
        fromCallCount++;
        const data = fromCallCount === 1
          ? { id: PLAN_ID, share_slug: 'ppl-abc123' }
          : FULL_PLAN_ROW;
        return makeSelectBuilder(data);
      }),
    };

    mockRequireUser.mockResolvedValueOnce({ supabase, user: { id: USER_ID } as any });
    mockWithIdempotency.mockImplementation(async (opts: any) => {
      const r = await opts.handler();
      return { replayed: false, resourceId: r.resourceId, response: r.response };
    });

    const res = await POST(makeRequest());
    const json = await res.json();

    expect(res.status).toBe(201);
    expect(json.id).toBe(PLAN_ID);
    expect(json.shareSlug).toBe('ppl-abc123');
    expect(json.workouts).toHaveLength(1);
    expect(supabase.rpc).toHaveBeenCalledWith('create_plan_with_children', expect.objectContaining({
      p_name: 'Push/Pull/Legs',
      p_client_mutation_id: CLIENT_MUTATION_ID,
    }));
    // Verify snake_case mapping in p_workouts
    const rpcCall = supabase.rpc.mock.calls[0]![1];
    expect(rpcCall.p_workouts[0].exercises[0].exercise_id).toBe(EXERCISE_ID);
    expect(rpcCall.p_workouts[0].exercises[0].target_sets).toBe(3);
    expect(rpcCall.p_workouts[0].exercises[0].target_reps).toBe(10);
  });

  it('uses 200 (not 201) for idempotent replay', async () => {
    const supabase: any = {
      from: vi.fn().mockReturnValue(makeSelectBuilder(FULL_PLAN_ROW)),
    };

    mockRequireUser.mockResolvedValueOnce({ supabase, user: { id: USER_ID } as any });
    mockWithIdempotency.mockResolvedValueOnce({
      replayed: true,
      resourceId: PLAN_ID,
      response: null,
    });

    const res = await POST(makeRequest());
    expect(res.status).toBe(200);
  });
});
