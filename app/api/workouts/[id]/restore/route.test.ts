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

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';
const WORKOUT_ID = '660e8400-e29b-41d4-a716-446655440000';
const DRAFT_ID   = '770e8400-e29b-41d4-a716-446655440000';
const USER_ID    = 'user-aaa0-0000-0000-000000000000';

/**
 * Supabase mock whose maybySingle returns different rows per from() call count.
 * Call 1: target workout fetch (by id + user_id).
 * Call 2: active draft check (by user_id + status = 'in_progress').
 */
function makeRestoreSupabase(opts: {
  targetWorkout: Record<string, unknown> | null;
  activeDraft?: Record<string, unknown> | null;
}) {
  let callCount = 0;
  return {
    from: vi.fn().mockImplementation(() => {
      callCount++;
      const data = callCount === 1 ? opts.targetWorkout : (opts.activeDraft ?? null);
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data, error: null }),
            }),
          }),
        }),
      };
    }),
  };
}

function makeRequest(workoutId = WORKOUT_ID): [Request, { params: Promise<{ id: string }> }] {
  return [
    new Request(`http://localhost/api/workouts/${workoutId}/restore`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientMutationId: VALID_UUID }),
    }),
    { params: Promise.resolve({ id: workoutId }) },
  ];
}

describe('POST /api/workouts/[id]/restore', () => {
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

  it('returns 400 VALIDATION_ERROR when body fails schema validation', async () => {
    mockRequireUser.mockResolvedValueOnce({
      supabase: makeRestoreSupabase({ targetWorkout: null }) as any,
      user: { id: USER_ID } as any,
    });

    const [, ctx] = makeRequest();
    const res = await POST(
      new Request(`http://localhost/api/workouts/${WORKOUT_ID}/restore`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientMutationId: 'not-a-uuid' }),
      }),
      ctx,
    );

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 422 ACTIVE_DRAFT_EXISTS when user already has an in_progress workout', async () => {
    const expiredWorkout = {
      id: WORKOUT_ID,
      name: null,
      status: 'expired',
      started_at: '2026-01-01T00:00:00.000Z',
      last_activity_at: '2026-01-01T00:00:00.000Z',
      plan_workout_id: null,
    };
    const activeDraft = {
      id: DRAFT_ID,
      name: 'Active Workout',
      started_at: '2026-04-01T00:00:00.000Z',
      last_activity_at: '2026-04-01T00:00:00.000Z',
      plan_workout_id: null,
    };

    mockRequireUser.mockResolvedValueOnce({
      supabase: makeRestoreSupabase({ targetWorkout: expiredWorkout, activeDraft }) as any,
      user: { id: USER_ID } as any,
    });

    // Call through so the inner handler logic runs and throws RouteError(activeDraftExistsResponse).
    mockWithIdempotency.mockImplementation(async (opts: any) => opts.handler());

    const [req, ctx] = makeRequest();
    const res = await POST(req, ctx);

    expect(res.status).toBe(422);
    const json = await res.json();
    expect(json.error.code).toBe('ACTIVE_DRAFT_EXISTS');
    expect(json.error.details.activeDraft.id).toBe(DRAFT_ID);
  });
});
