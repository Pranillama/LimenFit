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

import { POST } from './route';
import { requireUser } from '@/lib/api/auth';

const mockRequireUser = vi.mocked(requireUser);
const USER_ID = 'user-aaa0-0000-0000-000000000000';

function makeRequest(body: unknown): Request {
  return new Request('http://localhost/api/bodyweight', {
    method: 'POST',
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

describe('POST /api/bodyweight', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when requireUser throws ApiAuthError', async () => {
    const { ApiAuthError } = await import('@/lib/api/auth');
    mockRequireUser.mockRejectedValueOnce(new ApiAuthError());

    const res = await POST(makeRequest({ weightKg: 84.5 }));

    expect(res.status).toBe(401);
    expect((await res.json()).error.code).toBe('UNAUTHORIZED');
  });

  it('returns 400 VALIDATION_ERROR for a non-positive weight', async () => {
    mockRequireUser.mockResolvedValueOnce({
      supabase: makeSupabase(null),
      user: { id: USER_ID } as any,
    });

    const res = await POST(makeRequest({ weightKg: 0 }));

    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 201 with the upserted entry DTO', async () => {
    mockRequireUser.mockResolvedValueOnce({
      supabase: makeSupabase({
        id: 'entry-1',
        weight_kg: 84.5,
        recorded_on: '2026-06-07',
      }),
      user: { id: USER_ID } as any,
    });

    const res = await POST(makeRequest({ weightKg: 84.5 }));

    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json).toEqual({ id: 'entry-1', weightKg: 84.5, recordedOn: '2026-06-07' });
  });

  it('upserts with onConflict on user_id,recorded_on', async () => {
    const upsertSpy = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: { id: 'entry-1', weight_kg: 84.5, recorded_on: '2026-06-07' },
          error: null,
        }),
      }),
    });
    const supabase: any = { from: vi.fn().mockReturnValue({ upsert: upsertSpy }) };
    mockRequireUser.mockResolvedValueOnce({ supabase, user: { id: USER_ID } as any });

    await POST(makeRequest({ weightKg: 84.5 }));

    expect(upsertSpy).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: USER_ID, weight_kg: 84.5 }),
      { onConflict: 'user_id,recorded_on', ignoreDuplicates: false },
    );
  });
});
