import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/env', () => ({
  assertServerOnly: () => {},
  env: {
    server: { NODE_ENV: 'test', SUPABASE_SERVICE_ROLE_KEY: 'test' },
    client: {
      NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon',
      NEXT_PUBLIC_SITE_URL: 'https://localhost',
    },
  },
}));

vi.mock('@/lib/api/auth', () => ({
  requireUser: vi.fn(),
  ApiAuthError: class ApiAuthError extends Error {
    constructor(message = 'Unauthorized') {
      super(message);
      this.name = 'ApiAuthError';
    }
  },
}));

import { PATCH } from './route';
import { requireUser } from '@/lib/api/auth';

const mockRequireUser = vi.mocked(requireUser);
const USER_ID = 'user-aaa0-0000-0000-000000000000';

function makeRequest(body: unknown): Request {
  return new Request('http://localhost/api/measurements', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const FULL_ROW = {
  body_fat_pct: 17.5,
  waist_cm: 83.8,
  chest_cm: 106.7,
  arms_cm: 39.4,
  legs_cm: 61,
  recorded_on: '2026-06-07',
};

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

describe('PATCH /api/measurements', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when requireUser throws ApiAuthError', async () => {
    const { ApiAuthError } = await import('@/lib/api/auth');
    mockRequireUser.mockRejectedValueOnce(new ApiAuthError());

    const res = await PATCH(makeRequest({ waistCm: 83.8 }));

    expect(res.status).toBe(401);
    expect((await res.json()).error.code).toBe('UNAUTHORIZED');
  });

  it('returns 400 VALIDATION_ERROR on empty body', async () => {
    mockRequireUser.mockResolvedValueOnce({
      supabase: makeSupabase(null),
      user: { id: USER_ID } as any,
    });

    const res = await PATCH(makeRequest({}));

    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 200 with the measurements DTO on partial update', async () => {
    mockRequireUser.mockResolvedValueOnce({
      supabase: makeSupabase(FULL_ROW),
      user: { id: USER_ID } as any,
    });

    const res = await PATCH(makeRequest({ waistCm: 83.8 }));

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.waistCm).toBe(83.8);
    expect(json.bodyFatPct).toBe(17.5);
    expect(json.recordedOn).toBe('2026-06-07');
  });

  it('maps camelCase fields to snake_case columns in the upsert', async () => {
    const upsertSpy = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: FULL_ROW, error: null }),
      }),
    });
    const supabase: any = { from: vi.fn().mockReturnValue({ upsert: upsertSpy }) };
    mockRequireUser.mockResolvedValueOnce({ supabase, user: { id: USER_ID } as any });

    await PATCH(makeRequest({ bodyFatPct: 17.5, waistCm: 83.8 }));

    expect(upsertSpy).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: USER_ID, body_fat_pct: 17.5, waist_cm: 83.8 }),
      { onConflict: 'user_id,recorded_on', ignoreDuplicates: false },
    );
  });
});
