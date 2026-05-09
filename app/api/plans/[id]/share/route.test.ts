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
const SHARE_SLUG = 'plan-slug-abc';

function makeRequest(
  id = PLAN_ID,
  body: object = { clientMutationId: CLIENT_MUTATION_ID },
): [Request, { params: Promise<{ id: string }> }] {
  return [
    new Request(`http://localhost/api/plans/${id}/share`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id }) },
  ];
}

/** Mock for `.update(...).eq(...).eq(...).select(...).maybeSingle()`. */
function makeUpdateChain(data: any) {
  const chain: any = {
    update: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    select: vi.fn(() => chain),
    maybeSingle: vi.fn().mockResolvedValue({ data, error: null }),
  };
  return chain;
}

/** Mock for `.select(...).eq(...).eq(...).maybeSingle()`. */
function makeSelectChain(data: any) {
  const chain: any = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    maybeSingle: vi.fn().mockResolvedValue({ data, error: null }),
  };
  return chain;
}

describe('POST /api/plans/[id]/share', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when requireUser throws ApiAuthError', async () => {
    const { ApiAuthError } = await import('@/lib/api/auth');
    mockRequireUser.mockRejectedValueOnce(new ApiAuthError());

    const [req, ctx] = makeRequest();
    const res = await POST(req, ctx);

    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 400 INVALID_ID when id param is not a valid UUID', async () => {
    mockRequireUser.mockResolvedValueOnce({
      supabase: {} as any,
      user: { id: USER_ID } as any,
    });

    const [req, ctx] = makeRequest('not-a-uuid');
    const res = await POST(req, ctx);

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

    const [req, ctx] = makeRequest(PLAN_ID, { clientMutationId: 'not-a-uuid' });
    const res = await POST(req, ctx);

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error.code).toBe('VALIDATION_ERROR');
    expect(mockWithIdempotency).not.toHaveBeenCalled();
  });

  it('returns 404 NOT_FOUND when no row updated (plan not owned or missing)', async () => {
    const supabase: any = {
      from: vi.fn().mockReturnValue(makeUpdateChain(null)),
    };

    mockRequireUser.mockResolvedValueOnce({ supabase, user: { id: USER_ID } as any });
    mockWithIdempotency.mockImplementation(async (opts: any) => opts.handler());

    const [req, ctx] = makeRequest();
    const res = await POST(req, ctx);

    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error.code).toBe('NOT_FOUND');
  });

  it('returns 200 with id, clientMutationId, shareSlug, isPublic:true on first publish', async () => {
    const updateChain = makeUpdateChain({
      id: PLAN_ID,
      share_slug: SHARE_SLUG,
      is_public: true,
    });
    const supabase: any = {
      from: vi.fn().mockReturnValue(updateChain),
    };

    mockRequireUser.mockResolvedValueOnce({ supabase, user: { id: USER_ID } as any });
    mockWithIdempotency.mockImplementation(async (opts: any) => {
      const r = await opts.handler();
      return { replayed: false, resourceId: r.resourceId, response: r.response };
    });

    const [req, ctx] = makeRequest();
    const res = await POST(req, ctx);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toEqual({
      id: PLAN_ID,
      clientMutationId: CLIENT_MUTATION_ID,
      shareSlug: SHARE_SLUG,
      isPublic: true,
    });

    // is_public scoped by user_id
    expect(updateChain.update).toHaveBeenCalledWith({ is_public: true });

    const callArgs = mockWithIdempotency.mock.calls[0]![0];
    expect(callArgs.mutationType).toBe('plan.share');
    expect(callArgs.resourceType).toBe('plans');
  });

  it('scopes the UPDATE by id and user_id', async () => {
    const updateChain = makeUpdateChain({
      id: PLAN_ID,
      share_slug: SHARE_SLUG,
      is_public: true,
    });
    const supabase: any = {
      from: vi.fn().mockReturnValue(updateChain),
    };

    mockRequireUser.mockResolvedValueOnce({ supabase, user: { id: USER_ID } as any });
    mockWithIdempotency.mockImplementation(async (opts: any) => opts.handler());

    const [req, ctx] = makeRequest();
    await POST(req, ctx);

    const eqCalls = updateChain.eq.mock.calls;
    const eqMap = new Map(eqCalls);
    expect(eqMap.get('id')).toBe(PLAN_ID);
    expect(eqMap.get('user_id')).toBe(USER_ID);
  });

  it('returns 200 with same shape on idempotent replay (re-fetches share_slug for resourceId)', async () => {
    const supabase: any = {
      from: vi.fn().mockReturnValue(
        makeSelectChain({ share_slug: SHARE_SLUG, is_public: true }),
      ),
    };

    mockRequireUser.mockResolvedValueOnce({ supabase, user: { id: USER_ID } as any });
    mockWithIdempotency.mockResolvedValueOnce({
      replayed: true,
      resourceId: PLAN_ID,
      response: null,
    });

    const [req, ctx] = makeRequest();
    const res = await POST(req, ctx);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toEqual({
      id: PLAN_ID,
      clientMutationId: CLIENT_MUTATION_ID,
      shareSlug: SHARE_SLUG,
      isPublic: true,
    });
  });

  it('uses resourceId from receipt on replay, not URL id', async () => {
    const DIFFERENT_URL_ID = 'aaaaaaaa-e29b-41d4-a716-446655440000';
    let queriedPlanId: string | undefined;

    const chain: any = {
      select: vi.fn(() => chain),
      eq: vi.fn().mockImplementation((field: string, val: string) => {
        if (field === 'id') queriedPlanId = val;
        return chain;
      }),
      maybeSingle: vi.fn().mockResolvedValue({
        data: { share_slug: SHARE_SLUG, is_public: true },
        error: null,
      }),
    };
    const supabase: any = { from: vi.fn().mockReturnValue(chain) };

    mockRequireUser.mockResolvedValueOnce({ supabase, user: { id: USER_ID } as any });
    mockWithIdempotency.mockResolvedValueOnce({
      replayed: true,
      resourceId: PLAN_ID,
      response: null,
    });

    const [req, ctx] = makeRequest(DIFFERENT_URL_ID);
    const res = await POST(req, ctx);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.id).toBe(PLAN_ID);
    expect(queriedPlanId).toBe(PLAN_ID);
  });
});
