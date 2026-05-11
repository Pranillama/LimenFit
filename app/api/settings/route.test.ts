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

import { PATCH } from './route';
import { requireUser } from '@/lib/api/auth';

const mockRequireUser = vi.mocked(requireUser);

const USER_ID = 'user-aaa0-0000-0000-000000000000';

function makeRequest(body: unknown): Request {
  return new Request('http://localhost/api/settings', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function makeSupabase(returnData: unknown, returnError: unknown = null): any {
  return {
    from: vi.fn().mockReturnValue({
      upsert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: returnData, error: returnError }),
        }),
      }),
    }),
  };
}

describe('PATCH /api/settings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when requireUser throws ApiAuthError', async () => {
    const { ApiAuthError } = await import('@/lib/api/auth');
    mockRequireUser.mockRejectedValueOnce(new ApiAuthError());

    const res = await PATCH(makeRequest({ weightUnit: 'kg' }));

    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 400 VALIDATION_ERROR on empty body (no fields provided)', async () => {
    mockRequireUser.mockResolvedValueOnce({
      supabase: makeSupabase(null),
      user: { id: USER_ID } as any,
    });

    const res = await PATCH(makeRequest({}));

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 VALIDATION_ERROR when restTimerDefaultSeconds is negative', async () => {
    mockRequireUser.mockResolvedValueOnce({
      supabase: makeSupabase(null),
      user: { id: USER_ID } as any,
    });

    const res = await PATCH(makeRequest({ restTimerDefaultSeconds: -1 }));

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 VALIDATION_ERROR when restTimerDefaultSeconds exceeds 600', async () => {
    mockRequireUser.mockResolvedValueOnce({
      supabase: makeSupabase(null),
      user: { id: USER_ID } as any,
    });

    const res = await PATCH(makeRequest({ restTimerDefaultSeconds: 601 }));

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 VALIDATION_ERROR when restTimerDefaultSeconds is non-integer', async () => {
    mockRequireUser.mockResolvedValueOnce({
      supabase: makeSupabase(null),
      user: { id: USER_ID } as any,
    });

    const res = await PATCH(makeRequest({ restTimerDefaultSeconds: 30.5 }));

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 200 with updated settings on partial update (weightUnit only)', async () => {
    mockRequireUser.mockResolvedValueOnce({
      supabase: makeSupabase({ weight_unit: 'kg', rest_timer_default_seconds: 90 }),
      user: { id: USER_ID } as any,
    });

    const res = await PATCH(makeRequest({ weightUnit: 'kg' }));

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.weightUnit).toBe('kg');
    expect(json.restTimerDefaultSeconds).toBe(90);
  });

  it('returns 200 with updated settings on partial update (restTimerDefaultSeconds only)', async () => {
    mockRequireUser.mockResolvedValueOnce({
      supabase: makeSupabase({ weight_unit: 'lbs', rest_timer_default_seconds: 120 }),
      user: { id: USER_ID } as any,
    });

    const res = await PATCH(makeRequest({ restTimerDefaultSeconds: 120 }));

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.weightUnit).toBe('lbs');
    expect(json.restTimerDefaultSeconds).toBe(120);
  });

  it('returns 200 with DB defaults overlaid by patch on first-time-create', async () => {
    // Row was absent — upsert creates it; DB default supplies weight_unit='lbs'
    mockRequireUser.mockResolvedValueOnce({
      supabase: makeSupabase({ weight_unit: 'lbs', rest_timer_default_seconds: 180 }),
      user: { id: USER_ID } as any,
    });

    const res = await PATCH(makeRequest({ restTimerDefaultSeconds: 180 }));

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.weightUnit).toBe('lbs');
    expect(json.restTimerDefaultSeconds).toBe(180);
  });

  it('passes user_id and snake_case fields to upsert', async () => {
    const upsertSpy = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: { weight_unit: 'kg', rest_timer_default_seconds: 60 },
          error: null,
        }),
      }),
    });
    const supabase: any = {
      from: vi.fn().mockReturnValue({ upsert: upsertSpy }),
    };
    mockRequireUser.mockResolvedValueOnce({ supabase, user: { id: USER_ID } as any });

    await PATCH(makeRequest({ weightUnit: 'kg', restTimerDefaultSeconds: 60 }));

    expect(upsertSpy).toHaveBeenCalledWith(
      { user_id: USER_ID, weight_unit: 'kg', rest_timer_default_seconds: 60 },
      { onConflict: 'user_id', ignoreDuplicates: false },
    );
  });
});
