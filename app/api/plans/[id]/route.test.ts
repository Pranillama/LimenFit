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

import { PATCH, DELETE } from './route';
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
  name: 'Updated Plan',
  share_slug: 'plan-slug',
  is_public: false,
  created_at: '2026-05-07T00:00:00.000Z',
  updated_at: '2026-05-07T01:00:00.000Z',
  plan_workouts: [
    {
      id: 'pw-001',
      name: 'Day 1',
      position: 0,
      plan_exercises: [
        { id: 'pe-001', exercise_id: EXERCISE_ID, target_sets: 4, target_reps: 8, position: 0 },
      ],
    },
  ],
};

const EXPECTED_PLAN_RESPONSE = {
  id: PLAN_ID,
  clientMutationId: CLIENT_MUTATION_ID,
  name: 'Updated Plan',
  shareSlug: 'plan-slug',
  isPublic: false,
  createdAt: '2026-05-07T00:00:00.000Z',
  updatedAt: '2026-05-07T01:00:00.000Z',
  workouts: [
    {
      id: 'pw-001',
      name: 'Day 1',
      position: 0,
      exercises: [
        { id: 'pe-001', exerciseId: EXERCISE_ID, targetSets: 4, targetReps: 8, position: 0 },
      ],
    },
  ],
};

function makePatchRequest(id = PLAN_ID, body: object = {
  clientMutationId: CLIENT_MUTATION_ID,
  workouts: [{ name: 'Day 1', position: 0, exercises: [{ exerciseId: EXERCISE_ID, targetSets: 4, targetReps: 8, position: 0 }] }],
}): [Request, { params: Promise<{ id: string }> }] {
  return [
    new Request(`http://localhost/api/plans/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id }) },
  ];
}

function makeDeleteRequest(id = PLAN_ID): [Request, { params: Promise<{ id: string }> }] {
  return [
    new Request(`http://localhost/api/plans/${id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientMutationId: CLIENT_MUTATION_ID }),
    }),
    { params: Promise.resolve({ id }) },
  ];
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

describe('PATCH /api/plans/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when requireUser throws ApiAuthError', async () => {
    const { ApiAuthError } = await import('@/lib/api/auth');
    mockRequireUser.mockRejectedValueOnce(new ApiAuthError());

    const [req, ctx] = makePatchRequest();
    const res = await PATCH(req, ctx);

    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 400 INVALID_ID when id param is not a valid UUID', async () => {
    mockRequireUser.mockResolvedValueOnce({
      supabase: {} as any,
      user: { id: USER_ID } as any,
    });

    const [req, ctx] = makePatchRequest('not-a-uuid');
    const res = await PATCH(req, ctx);

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error.code).toBe('INVALID_ID');
    expect(mockWithIdempotency).not.toHaveBeenCalled();
  });

  it('returns 400 VALIDATION_ERROR when body fails schema validation', async () => {
    mockRequireUser.mockResolvedValueOnce({
      supabase: {} as any,
      user: { id: USER_ID } as any,
    });

    const [, ctx] = makePatchRequest();
    const req = new Request(`http://localhost/api/plans/${PLAN_ID}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientMutationId: 'not-a-uuid' }),
    });

    const res = await PATCH(req, ctx);

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error.code).toBe('VALIDATION_ERROR');
    expect(mockWithIdempotency).not.toHaveBeenCalled();
  });

  it('returns 200 with nested shape on happy-path patch with workouts', async () => {
    const supabase: any = {
      rpc: vi.fn().mockResolvedValue({ data: [{ plan_id: PLAN_ID }], error: null }),
      from: vi.fn().mockReturnValue(makeSelectBuilder(FULL_PLAN_ROW)),
    };

    mockRequireUser.mockResolvedValueOnce({ supabase, user: { id: USER_ID } as any });
    mockWithIdempotency.mockImplementation(async (opts: any) => {
      const r = await opts.handler();
      return { replayed: false, resourceId: r.resourceId, response: r.response };
    });

    const [req, ctx] = makePatchRequest(PLAN_ID, {
      clientMutationId: CLIENT_MUTATION_ID,
      name: 'Updated Plan',
      workouts: [{ name: 'Day 1', position: 0, exercises: [{ exerciseId: EXERCISE_ID, targetSets: 4, targetReps: 8, position: 0 }] }],
    });
    const res = await PATCH(req, ctx);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toEqual(EXPECTED_PLAN_RESPONSE);
    expect(supabase.rpc).toHaveBeenCalledWith('update_plan_with_children', expect.objectContaining({
      p_plan_id: PLAN_ID,
      p_name: 'Updated Plan',
    }));
    const rpcCall = supabase.rpc.mock.calls[0]![1];
    expect(rpcCall.p_workouts[0].exercises[0].exercise_id).toBe(EXERCISE_ID);
    expect(rpcCall.p_workouts[0].exercises[0].target_sets).toBe(4);
    expect(rpcCall.p_workouts[0].exercises[0].target_reps).toBe(8);
  });

  it('fetches current name from DB when only workouts are provided', async () => {
    let fromCallCount = 0;
    const supabase: any = {
      rpc: vi.fn().mockResolvedValue({ data: [{ plan_id: PLAN_ID }], error: null }),
      from: vi.fn().mockImplementation(() => {
        fromCallCount++;
        if (fromCallCount === 1) {
          // Current name fetch
          return makeSelectBuilder({ name: 'Current Name' });
        }
        // fetchPlanById re-select
        return makeSelectBuilder(FULL_PLAN_ROW);
      }),
    };

    mockRequireUser.mockResolvedValueOnce({ supabase, user: { id: USER_ID } as any });
    mockWithIdempotency.mockImplementation(async (opts: any) => {
      const r = await opts.handler();
      return { replayed: false, resourceId: r.resourceId, response: r.response };
    });

    const [req, ctx] = makePatchRequest(PLAN_ID, {
      clientMutationId: CLIENT_MUTATION_ID,
      workouts: [{ name: 'Day 1', position: 0, exercises: [{ exerciseId: EXERCISE_ID, targetSets: 4, targetReps: 8, position: 0 }] }],
    });
    const res = await PATCH(req, ctx);

    expect(res.status).toBe(200);
    expect(supabase.rpc).toHaveBeenCalledWith('update_plan_with_children', expect.objectContaining({
      p_name: 'Current Name',
    }));
  });

  it('returns 200 with nested shape on name-only patch', async () => {
    const supabase: any = {
      rpc: vi.fn().mockResolvedValue({ data: [{ plan_id: PLAN_ID }], error: null }),
      from: vi.fn().mockReturnValue(makeSelectBuilder(FULL_PLAN_ROW)),
    };

    mockRequireUser.mockResolvedValueOnce({ supabase, user: { id: USER_ID } as any });
    mockWithIdempotency.mockImplementation(async (opts: any) => {
      const r = await opts.handler();
      return { replayed: false, resourceId: r.resourceId, response: r.response };
    });

    const [req, ctx] = makePatchRequest(PLAN_ID, {
      clientMutationId: CLIENT_MUTATION_ID,
      name: 'Updated Plan',
    });
    const res = await PATCH(req, ctx);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.name).toBe('Updated Plan');
    expect(supabase.rpc).toHaveBeenCalledWith('update_plan_name', expect.objectContaining({
      p_plan_id: PLAN_ID,
      p_name: 'Updated Plan',
      p_client_mutation_id: CLIENT_MUTATION_ID,
    }));
  });

  it('returns 404 when RPC returns zero rows', async () => {
    const supabase: any = {
      rpc: vi.fn().mockResolvedValue({ data: [], error: null }),
      from: vi.fn().mockReturnValue(makeSelectBuilder({ name: 'Existing Plan' })),
    };

    mockRequireUser.mockResolvedValueOnce({ supabase, user: { id: USER_ID } as any });
    mockWithIdempotency.mockImplementation(async (opts: any) => opts.handler());

    const [req, ctx] = makePatchRequest(PLAN_ID, {
      clientMutationId: CLIENT_MUTATION_ID,
      name: 'Updated Plan',
      workouts: [{ name: 'Day 1', position: 0, exercises: [{ exerciseId: EXERCISE_ID, targetSets: 4, targetReps: 8, position: 0 }] }],
    });
    const res = await PATCH(req, ctx);

    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error.code).toBe('NOT_FOUND');
  });

  it('returns 200 on idempotent replay', async () => {
    const supabase: any = {
      from: vi.fn().mockReturnValue(makeSelectBuilder(FULL_PLAN_ROW)),
    };

    mockRequireUser.mockResolvedValueOnce({ supabase, user: { id: USER_ID } as any });
    mockWithIdempotency.mockResolvedValueOnce({
      replayed: true,
      resourceId: PLAN_ID,
      response: null,
    });

    const [req, ctx] = makePatchRequest();
    const res = await PATCH(req, ctx);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toEqual(EXPECTED_PLAN_RESPONSE);
  });

  it('both concurrent same-key PATCH calls produce identical child IDs and updatedAt', async () => {
    // Simulates the race: withIdempotency lets both handlers through (cache miss on both).
    // The RPC must receive p_client_mutation_id so the DB-level FOR UPDATE + duplicate
    // check can prevent the second call from rewriting children with fresh UUIDs.
    const supabase: any = {
      rpc: vi.fn().mockResolvedValue({ data: [{ plan_id: PLAN_ID }], error: null }),
      from: vi.fn().mockReturnValue(makeSelectBuilder(FULL_PLAN_ROW)),
    };

    mockRequireUser.mockResolvedValue({ supabase, user: { id: USER_ID } as any });
    mockWithIdempotency.mockImplementation(async (opts: any) => {
      const r = await opts.handler();
      return { replayed: false, resourceId: r.resourceId, response: r.response };
    });

    const patchBody = {
      clientMutationId: CLIENT_MUTATION_ID,
      name: 'Updated Plan',
      workouts: [{ name: 'Day 1', position: 0, exercises: [{ exerciseId: EXERCISE_ID, targetSets: 4, targetReps: 8, position: 0 }] }],
    };
    const [req1, ctx1] = makePatchRequest(PLAN_ID, patchBody);
    const [req2, ctx2] = makePatchRequest(PLAN_ID, patchBody);

    const [res1, res2] = await Promise.all([PATCH(req1, ctx1), PATCH(req2, ctx2)]);
    const [json1, json2] = await Promise.all([res1.json(), res2.json()]);

    expect(res1.status).toBe(200);
    expect(res2.status).toBe(200);
    expect(json1.workouts[0].id).toBe(json2.workouts[0].id);
    expect(json1.updatedAt).toBe(json2.updatedAt);
    expect(supabase.rpc).toHaveBeenCalledWith('update_plan_with_children', expect.objectContaining({
      p_client_mutation_id: CLIENT_MUTATION_ID,
    }));
  });

  it('uses resourceId from receipt on replay, not URL id', async () => {
    // If a retry reaches a different URL, the replay branch must re-fetch by
    // result.resourceId (the plan from the original request), not by the URL id.
    const DIFFERENT_URL_ID = 'aaaaaaaa-e29b-41d4-a716-446655440000';
    let queriedPlanId: string | undefined;

    const supabase: any = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockImplementation((field: string, val: string) => {
            if (field === 'id') queriedPlanId = val;
            return {
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: FULL_PLAN_ROW, error: null }),
              }),
            };
          }),
        }),
      }),
    };

    mockRequireUser.mockResolvedValueOnce({ supabase, user: { id: USER_ID } as any });
    mockWithIdempotency.mockResolvedValueOnce({
      replayed: true,
      resourceId: PLAN_ID,
      response: null,
    });

    const [req, ctx] = makePatchRequest(DIFFERENT_URL_ID);
    const res = await PATCH(req, ctx);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.id).toBe(PLAN_ID);
    expect(queriedPlanId).toBe(PLAN_ID);
  });
});

describe('DELETE /api/plans/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when requireUser throws ApiAuthError', async () => {
    const { ApiAuthError } = await import('@/lib/api/auth');
    mockRequireUser.mockRejectedValueOnce(new ApiAuthError());

    const [req, ctx] = makeDeleteRequest();
    const res = await DELETE(req, ctx);

    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 400 INVALID_ID when id param is not a valid UUID', async () => {
    mockRequireUser.mockResolvedValueOnce({
      supabase: {} as any,
      user: { id: USER_ID } as any,
    });

    const [req, ctx] = makeDeleteRequest('not-a-uuid');
    const res = await DELETE(req, ctx);

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error.code).toBe('INVALID_ID');
    expect(mockWithIdempotency).not.toHaveBeenCalled();
  });

  it('returns 400 VALIDATION_ERROR when body fails schema validation', async () => {
    mockRequireUser.mockResolvedValueOnce({
      supabase: {} as any,
      user: { id: USER_ID } as any,
    });

    const [, ctx] = makeDeleteRequest();
    const req = new Request(`http://localhost/api/plans/${PLAN_ID}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientMutationId: 'not-a-uuid' }),
    });

    const res = await DELETE(req, ctx);

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 200 with id and clientMutationId on successful delete', async () => {
    const supabase: any = {
      from: vi.fn().mockReturnValue({
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
      }),
    };

    mockRequireUser.mockResolvedValueOnce({ supabase, user: { id: USER_ID } as any });
    mockWithIdempotency.mockImplementation(async (opts: any) => {
      const r = await opts.handler();
      return { replayed: false, resourceId: r.resourceId, response: r.response };
    });

    const [req, ctx] = makeDeleteRequest();
    const res = await DELETE(req, ctx);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.id).toBe(PLAN_ID);
    expect(json.clientMutationId).toBe(CLIENT_MUTATION_ID);
  });

  it('returns 200 idempotent success when plan is already gone (zero rows deleted)', async () => {
    const supabase: any = {
      from: vi.fn().mockReturnValue({
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
      }),
    };

    mockRequireUser.mockResolvedValueOnce({ supabase, user: { id: USER_ID } as any });
    mockWithIdempotency.mockImplementation(async (opts: any) => {
      const r = await opts.handler();
      return { replayed: false, resourceId: r.resourceId, response: r.response };
    });

    const [req, ctx] = makeDeleteRequest();
    const res = await DELETE(req, ctx);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.id).toBe(PLAN_ID);
    expect(json.clientMutationId).toBe(CLIENT_MUTATION_ID);
  });

  it('returns 200 on idempotent replay', async () => {
    mockRequireUser.mockResolvedValueOnce({
      supabase: {} as any,
      user: { id: USER_ID } as any,
    });
    mockWithIdempotency.mockResolvedValueOnce({
      replayed: true,
      resourceId: PLAN_ID,
      response: null,
    });

    const [req, ctx] = makeDeleteRequest();
    const res = await DELETE(req, ctx);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.id).toBe(PLAN_ID);
    expect(json.clientMutationId).toBe(CLIENT_MUTATION_ID);
  });
});
