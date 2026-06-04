import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/env', () => ({ assertServerOnly: () => {} }));

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

import { GET, PATCH } from './route';
import { requireUser } from '@/lib/api/auth';

const mockRequireUser = vi.mocked(requireUser);
const USER_ID = 'user-aaa0-0000-0000-000000000000';

function makeRequest(method: 'GET' | 'PATCH', body?: unknown): Request {
  return new Request('http://localhost/api/profile', {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? null : JSON.stringify(body),
  });
}

const FULL_ROW = {
  first_name: 'Ada',
  last_name: null,
  display_name: null,
  username: null,
  avatar_url: null,
  date_of_birth: null,
  gender: null,
  height_cm: null,
  starting_weight_kg: null,
  time_zone: null,
  primary_goal: null,
  goal_weight_kg: null,
  target_daily_calories: null,
  activity_level: null,
  training_experience: null,
  weekly_training_frequency: null,
};

function makeSupabaseForGet(): any {
  return {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({ data: FULL_ROW, error: null }),
        }),
      }),
    }),
  };
}

function makeSupabaseForPatch(rowAfter: Record<string, unknown>): {
  client: any;
  upsert: ReturnType<typeof vi.fn>;
} {
  const upsert = vi.fn().mockReturnValue({
    select: vi.fn().mockReturnValue({
      single: vi.fn().mockResolvedValue({ data: rowAfter, error: null }),
    }),
  });
  return { client: { from: vi.fn().mockReturnValue({ upsert }) }, upsert };
}

describe('/api/profile', () => {
  beforeEach(() => vi.clearAllMocks());

  it('GET returns 401 when unauthenticated', async () => {
    const { ApiAuthError } = await import('@/lib/api/auth');
    mockRequireUser.mockRejectedValueOnce(new ApiAuthError());
    const res = await GET(makeRequest('GET'));
    expect(res.status).toBe(401);
  });

  it('GET returns 200 with camelCase DTO', async () => {
    mockRequireUser.mockResolvedValueOnce({
      supabase: makeSupabaseForGet(),
      user: { id: USER_ID } as any,
    });
    const res = await GET(makeRequest('GET'));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.firstName).toBe('Ada');
    expect(json.lastName).toBeNull();
  });

  it('PATCH returns 400 on empty body', async () => {
    mockRequireUser.mockResolvedValueOnce({
      supabase: makeSupabaseForPatch(FULL_ROW).client,
      user: { id: USER_ID } as any,
    });
    const res = await PATCH(makeRequest('PATCH', {}));
    expect(res.status).toBe(400);
  });

  it('PATCH 400 on invalid enum', async () => {
    mockRequireUser.mockResolvedValueOnce({
      supabase: makeSupabaseForPatch(FULL_ROW).client,
      user: { id: USER_ID } as any,
    });
    const res = await PATCH(makeRequest('PATCH', { primaryGoal: 'bulking' }));
    expect(res.status).toBe(400);
  });

  it('PATCH passes snake_case fields to upsert', async () => {
    const { client, upsert } = makeSupabaseForPatch({
      ...FULL_ROW,
      first_name: 'Ada',
      primary_goal: 'strength',
    });
    mockRequireUser.mockResolvedValueOnce({ supabase: client, user: { id: USER_ID } as any });
    await PATCH(makeRequest('PATCH', { firstName: 'Ada', primaryGoal: 'strength' }));
    expect(upsert).toHaveBeenCalledWith(
      { user_id: USER_ID, first_name: 'Ada', primary_goal: 'strength' },
      { onConflict: 'user_id', ignoreDuplicates: false },
    );
  });

  it('PATCH returns 200 with canonical DTO', async () => {
    const { client } = makeSupabaseForPatch({ ...FULL_ROW, first_name: 'Ada' });
    mockRequireUser.mockResolvedValueOnce({ supabase: client, user: { id: USER_ID } as any });
    const res = await PATCH(makeRequest('PATCH', { firstName: 'Ada' }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.firstName).toBe('Ada');
  });
});
