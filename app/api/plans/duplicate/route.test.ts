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

vi.mock('@/lib/plans/duplicate', () => ({
  duplicatePlanForUser: vi.fn(),
  PlanNotFoundError: class PlanNotFoundError extends Error {
    constructor(planId: string) {
      super(`Plan not found: ${planId}`);
      this.name = 'PlanNotFoundError';
    }
  },
}));

import { POST } from './route';
import { requireUser } from '@/lib/api/auth';
import { withIdempotency } from '@/lib/idempotency/server';
import { duplicatePlanForUser, PlanNotFoundError } from '@/lib/plans/duplicate';

const mockRequireUser = vi.mocked(requireUser);
const mockWithIdempotency = vi.mocked(withIdempotency);
const mockDuplicatePlanForUser = vi.mocked(duplicatePlanForUser);

const CLIENT_MUTATION_ID = '550e8400-e29b-41d4-a716-446655440000';
const SOURCE_PLAN_ID = '660e8400-e29b-41d4-a716-446655440000';
const NEW_PLAN_ID = '770e8400-e29b-41d4-a716-446655440000';
const USER_ID = 'user-aaa0-0000-0000-000000000000';
const EXERCISE_ID = '880e8400-e29b-41d4-a716-446655440000';
const SOURCE_SHARE_SLUG = 'source-plan-slug';
const NEW_SHARE_SLUG = 'new-plan-slug';

const FULL_PLAN_ROW = {
  id: NEW_PLAN_ID,
  name: 'My Strength Plan',
  share_slug: NEW_SHARE_SLUG,
  is_public: false,
  created_at: '2026-05-09T00:00:00.000Z',
  updated_at: '2026-05-09T00:00:00.000Z',
  plan_workouts: [
    {
      id: 'pw-001',
      name: 'Day A',
      position: 0,
      plan_exercises: [
        {
          id: 'pe-001',
          exercise_id: EXERCISE_ID,
          target_sets: 3,
          target_reps: 5,
          position: 0,
        },
      ],
    },
  ],
};

const EXPECTED_PLAN_RESPONSE = {
  id: NEW_PLAN_ID,
  clientMutationId: CLIENT_MUTATION_ID,
  name: 'My Strength Plan',
  shareSlug: NEW_SHARE_SLUG,
  isPublic: false,
  createdAt: '2026-05-09T00:00:00.000Z',
  updatedAt: '2026-05-09T00:00:00.000Z',
  workouts: [
    {
      id: 'pw-001',
      name: 'Day A',
      position: 0,
      exercises: [
        {
          id: 'pe-001',
          exerciseId: EXERCISE_ID,
          targetSets: 3,
          targetReps: 5,
          position: 0,
        },
      ],
    },
  ],
};

function makeRequest(body: object = {
  clientMutationId: CLIENT_MUTATION_ID,
  sourceShareSlug: SOURCE_SHARE_SLUG,
}): Request {
  return new Request('http://localhost/api/plans/duplicate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

/**
 * Builds a chained `.from(...).select(...).eq(...).maybeSingle()` query mock.
 * Each call to `.eq` returns a builder that can be `.eq`'d again or terminated by `.maybeSingle`.
 */
function makeSelectChain(data: any) {
  const chain: any = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    maybeSingle: vi.fn().mockResolvedValue({ data, error: null }),
  };
  return chain;
}

describe('POST /api/plans/duplicate', () => {
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

    const res = await POST(makeRequest({ clientMutationId: 'not-a-uuid' }));

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error.code).toBe('VALIDATION_ERROR');
    expect(mockWithIdempotency).not.toHaveBeenCalled();
  });

  it('returns 400 VALIDATION_ERROR when sourceShareSlug is missing', async () => {
    mockRequireUser.mockResolvedValueOnce({
      supabase: {} as any,
      user: { id: USER_ID } as any,
    });

    const res = await POST(makeRequest({ clientMutationId: CLIENT_MUTATION_ID }));

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 404 NOT_FOUND when slug does not resolve to a public plan', async () => {
    const supabase: any = {
      from: vi.fn().mockReturnValue(makeSelectChain(null)),
    };

    mockRequireUser.mockResolvedValueOnce({ supabase, user: { id: USER_ID } as any });
    mockWithIdempotency.mockImplementation(async (opts: any) => {
      return opts.handler();
    });

    const res = await POST(makeRequest());

    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error.code).toBe('NOT_FOUND');
    expect(mockDuplicatePlanForUser).not.toHaveBeenCalled();
  });

  it('returns 404 NOT_FOUND when duplicate helper throws PlanNotFoundError', async () => {
    let fromCall = 0;
    const supabase: any = {
      from: vi.fn().mockImplementation(() => {
        fromCall++;
        // First call resolves slug → returns id; subsequent calls would re-fetch but we throw first.
        return makeSelectChain({ id: SOURCE_PLAN_ID });
      }),
    };

    mockRequireUser.mockResolvedValueOnce({ supabase, user: { id: USER_ID } as any });
    mockDuplicatePlanForUser.mockRejectedValueOnce(new PlanNotFoundError(SOURCE_PLAN_ID));
    mockWithIdempotency.mockImplementation(async (opts: any) => opts.handler());

    const res = await POST(makeRequest());

    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error.code).toBe('NOT_FOUND');
    expect(fromCall).toBe(1);
  });

  it('returns 201 with nested plan shape on first duplicate (calls helper with targetUserId = user.id)', async () => {
    let fromCall = 0;
    const supabase: any = {
      from: vi.fn().mockImplementation(() => {
        fromCall++;
        if (fromCall === 1) {
          // Resolve slug → source plan id
          return makeSelectChain({ id: SOURCE_PLAN_ID });
        }
        // fetchPlanById re-select after duplication
        return makeSelectChain(FULL_PLAN_ROW);
      }),
    };

    mockRequireUser.mockResolvedValueOnce({ supabase, user: { id: USER_ID } as any });
    mockDuplicatePlanForUser.mockResolvedValueOnce({
      planId: NEW_PLAN_ID,
      shareSlug: NEW_SHARE_SLUG,
    });
    mockWithIdempotency.mockImplementation(async (opts: any) => {
      const r = await opts.handler();
      return { replayed: false, resourceId: r.resourceId, response: r.response };
    });

    const res = await POST(makeRequest());
    const json = await res.json();

    expect(res.status).toBe(201);
    expect(json).toEqual(EXPECTED_PLAN_RESPONSE);
    expect(mockDuplicatePlanForUser).toHaveBeenCalledTimes(1);
    expect(mockDuplicatePlanForUser).toHaveBeenCalledWith(supabase, {
      sourcePlanId: SOURCE_PLAN_ID,
      targetUserId: USER_ID,
      clientMutationId: CLIENT_MUTATION_ID,
    });

    const callArgs = mockWithIdempotency.mock.calls[0]![0];
    expect(callArgs.mutationType).toBe('plan.duplicate');
    expect(callArgs.resourceType).toBe('plans');
  });

  it('forwards the request clientMutationId to duplicatePlanForUser so concurrent handlers race on the same unique key', async () => {
    const supabase: any = {
      from: vi.fn().mockImplementation((() => {
        let call = 0;
        return () => {
          call++;
          if (call === 1) return makeSelectChain({ id: SOURCE_PLAN_ID });
          return makeSelectChain(FULL_PLAN_ROW);
        };
      })()),
    };

    mockRequireUser.mockResolvedValueOnce({ supabase, user: { id: USER_ID } as any });
    mockDuplicatePlanForUser.mockResolvedValueOnce({
      planId: NEW_PLAN_ID,
      shareSlug: NEW_SHARE_SLUG,
    });
    mockWithIdempotency.mockImplementation(async (opts: any) => {
      const r = await opts.handler();
      return { replayed: false, resourceId: r.resourceId, response: r.response };
    });

    await POST(makeRequest());

    const helperCall = mockDuplicatePlanForUser.mock.calls[0]![1] as Record<string, unknown>;
    expect(helperCall.clientMutationId).toBe(CLIENT_MUTATION_ID);
  });

  it('returns 201 with the race-recovered plan when duplicatePlanForUser converged on an existing planId after 23505', async () => {
    // Simulates the duplicate-create race: a concurrent handler won the
    // unique-index race, our handler's RPC raised 23505, and the helper
    // recovered by reading back the existing row. The route should treat
    // that recovered planId exactly like a fresh insert.
    let fromCall = 0;
    const supabase: any = {
      from: vi.fn().mockImplementation(() => {
        fromCall++;
        if (fromCall === 1) {
          return makeSelectChain({ id: SOURCE_PLAN_ID });
        }
        return makeSelectChain(FULL_PLAN_ROW);
      }),
    };

    mockRequireUser.mockResolvedValueOnce({ supabase, user: { id: USER_ID } as any });
    // Helper internally absorbed the 23505 and returned the row produced by
    // the winning concurrent insert.
    mockDuplicatePlanForUser.mockResolvedValueOnce({
      planId: NEW_PLAN_ID,
      shareSlug: NEW_SHARE_SLUG,
    });
    mockWithIdempotency.mockImplementation(async (opts: any) => {
      const r = await opts.handler();
      return { replayed: false, resourceId: r.resourceId, response: r.response };
    });

    const res = await POST(makeRequest());
    const json = await res.json();

    expect(res.status).toBe(201);
    expect(json).toEqual(EXPECTED_PLAN_RESPONSE);
    expect(mockDuplicatePlanForUser).toHaveBeenCalledWith(supabase, {
      sourcePlanId: SOURCE_PLAN_ID,
      targetUserId: USER_ID,
      clientMutationId: CLIENT_MUTATION_ID,
    });
  });

  it('returns 200 with same shape on idempotent replay (re-fetches by resourceId)', async () => {
    const supabase: any = {
      from: vi.fn().mockReturnValue(makeSelectChain(FULL_PLAN_ROW)),
    };

    mockRequireUser.mockResolvedValueOnce({ supabase, user: { id: USER_ID } as any });
    mockWithIdempotency.mockResolvedValueOnce({
      replayed: true,
      resourceId: NEW_PLAN_ID,
      response: null,
    });

    const res = await POST(makeRequest());
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toEqual(EXPECTED_PLAN_RESPONSE);
    expect(mockDuplicatePlanForUser).not.toHaveBeenCalled();
  });
});
