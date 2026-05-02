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

const CLIENT_MUTATION_ID  = '550e8400-e29b-41d4-a716-446655440000';
const WORKOUT_EXERCISE_ID = '660e8400-e29b-41d4-a716-446655440000';
const RESOURCE_ID         = '880e8400-e29b-41d4-a716-446655440000';
const USER_ID             = 'user-aaa0-0000-0000-000000000000';

function makeRequest(): Request {
  return new Request('http://localhost/api/sets', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      clientMutationId: CLIENT_MUTATION_ID,
      localId: '990e8400-e29b-41d4-a716-446655440000',
      workoutExerciseId: WORKOUT_EXERCISE_ID,
      setNumber: 1,
      reps: 10,
      weightValue: 60,
      weightUnit: 'kg',
      loggedAt: '2026-05-01T10:00:00.000Z',
    }),
  });
}

function makeSupabase(): any {
  return {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      }),
    }),
  };
}

describe('POST /api/sets', () => {
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
      supabase: makeSupabase(),
      user: { id: USER_ID } as any,
    });

    const req = new Request('http://localhost/api/sets', {
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

  it('returns 200 with id + clientMutationId on replay', async () => {
    mockRequireUser.mockResolvedValueOnce({
      supabase: makeSupabase(),
      user: { id: USER_ID } as any,
    });
    mockWithIdempotency.mockResolvedValueOnce({
      replayed: true,
      resourceId: RESOURCE_ID,
      response: null,
    });

    const res = await POST(makeRequest());

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.id).toBe(RESOURCE_ID);
    expect(json.clientMutationId).toBe(CLIENT_MUTATION_ID);
  });

  it('returns 201 with id + clientMutationId on first log', async () => {
    mockRequireUser.mockResolvedValueOnce({
      supabase: makeSupabase(),
      user: { id: USER_ID } as any,
    });
    mockWithIdempotency.mockResolvedValueOnce({
      replayed: false,
      resourceId: RESOURCE_ID,
      response: { id: RESOURCE_ID, clientMutationId: CLIENT_MUTATION_ID },
    });

    const res = await POST(makeRequest());

    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.id).toBe(RESOURCE_ID);
    expect(json.clientMutationId).toBe(CLIENT_MUTATION_ID);
  });
});
