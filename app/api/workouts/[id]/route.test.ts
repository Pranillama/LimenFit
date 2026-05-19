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

vi.mock('next/cache', () => ({
  revalidateTag: vi.fn(),
}));

// Prevent lib/insights/server.ts from pulling in next/headers / supabase
vi.mock('@/lib/insights', () => ({
  insightsTag: (userId: string) => `insights:${userId}`,
}));

import { PATCH } from './route';
import { requireUser } from '@/lib/api/auth';
import { withIdempotency } from '@/lib/idempotency/server';
import { revalidateTag } from 'next/cache';

const mockRequireUser = vi.mocked(requireUser);
const mockWithIdempotency = vi.mocked(withIdempotency);
const mockRevalidateTag = vi.mocked(revalidateTag);

const WORKOUT_ID = '550e8400-e29b-41d4-a716-446655440000';
const USER_ID = 'user-abc';
const CLIENT_MUTATION_ID = '550e8400-e29b-41d4-a716-446655440001';

function makeRequest(body: Record<string, unknown>): Request {
  return new Request(`http://localhost/api/workouts/${WORKOUT_ID}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clientMutationId: CLIENT_MUTATION_ID, ...body }),
  });
}

function makeParams(): Promise<{ id: string }> {
  return Promise.resolve({ id: WORKOUT_ID });
}

/**
 * Build a minimal Supabase mock for the PATCH handler.
 *
 * flipRows: rows returned by the completed_at update (empty = no flip, i.e. already completed).
 */
function makeSupabase({ flipRows = [{ id: WORKOUT_ID }] }: { flipRows?: { id: string }[] } = {}) {
  let updateCallCount = 0;

  return {
    from: () => ({
      update: (patch: Record<string, unknown>) => {
        updateCallCount++;
        const isCompletedAtUpdate = 'completed_at' in patch;

        if (isCompletedAtUpdate) {
          // Second update: completed_at flip — supports .eq().eq().eq().is().select()
          const builder = {
            eq: () => builder,
            is: () => ({
              select: () => Promise.resolve({ data: flipRows, error: null }),
            }),
          };
          return builder;
        }

        // First update: main patch — supports .eq().eq().neq().select().maybeSingle()
        const builder = {
          eq: () => builder,
          neq: () => ({
            select: () => ({
              maybeSingle: () => Promise.resolve({ data: { id: WORKOUT_ID }, error: null }),
            }),
          }),
        };
        return builder;
      },
    }),
  };
}

function setupWithIdempotency() {
  mockWithIdempotency.mockImplementation(async (opts: any) => {
    const result = await opts.handler();
    return { replayed: false, resourceId: result.resourceId, response: result.response };
  });
}

describe('PATCH /api/workouts/[id] — revalidateTag on completion', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls revalidateTag with the user insights tag on first completion', async () => {
    mockRequireUser.mockResolvedValue({
      supabase: makeSupabase({ flipRows: [{ id: WORKOUT_ID }] }) as any,
      user: { id: USER_ID } as any,
    });
    setupWithIdempotency();

    const res = await PATCH(makeRequest({ status: 'completed' }), { params: makeParams() });

    expect(res.status).toBe(200);
    expect(mockRevalidateTag).toHaveBeenCalledTimes(1);
    expect(mockRevalidateTag).toHaveBeenCalledWith(`insights:${USER_ID}`);
  });

  it('does not call revalidateTag when completed_at was already set (replayed completion)', async () => {
    mockRequireUser.mockResolvedValue({
      supabase: makeSupabase({ flipRows: [] }) as any,
      user: { id: USER_ID } as any,
    });
    setupWithIdempotency();

    const res = await PATCH(makeRequest({ status: 'completed' }), { params: makeParams() });

    expect(res.status).toBe(200);
    expect(mockRevalidateTag).not.toHaveBeenCalled();
  });

  it('does not call revalidateTag for non-completion PATCH bodies', async () => {
    mockRequireUser.mockResolvedValue({
      supabase: makeSupabase() as any,
      user: { id: USER_ID } as any,
    });
    setupWithIdempotency();

    const res = await PATCH(makeRequest({ status: 'in_progress' }), { params: makeParams() });

    expect(res.status).toBe(200);
    expect(mockRevalidateTag).not.toHaveBeenCalled();
  });

  it('does not call revalidateTag on a name-only PATCH', async () => {
    mockRequireUser.mockResolvedValue({
      supabase: makeSupabase() as any,
      user: { id: USER_ID } as any,
    });
    setupWithIdempotency();

    const res = await PATCH(makeRequest({ name: 'Morning Lift' }), { params: makeParams() });

    expect(res.status).toBe(200);
    expect(mockRevalidateTag).not.toHaveBeenCalled();
  });

  it('returns 200 even when revalidateTag throws — cache failure must not break the request', async () => {
    mockRevalidateTag.mockImplementationOnce(() => {
      throw new Error('cache service unavailable');
    });
    mockRequireUser.mockResolvedValue({
      supabase: makeSupabase({ flipRows: [{ id: WORKOUT_ID }] }) as any,
      user: { id: USER_ID } as any,
    });
    setupWithIdempotency();

    const res = await PATCH(makeRequest({ status: 'completed' }), { params: makeParams() });

    expect(res.status).toBe(200);
    expect(mockRevalidateTag).toHaveBeenCalledTimes(1);
  });
});
