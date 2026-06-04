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

const deleteUser = vi.fn();

vi.mock('@/lib/supabase/service-role', () => ({
  createSupabaseServiceRoleClient: () => ({
    auth: { admin: { deleteUser } },
  }),
}));

import { POST } from './route';
import { requireUser } from '@/lib/api/auth';

const mockRequireUser = vi.mocked(requireUser);
const USER_ID = 'user-aaa0-0000-0000-000000000000';

function makeRequest(body: unknown): Request {
  return new Request('http://localhost/api/account/delete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function makeSignOutSupabase(): any {
  return { auth: { signOut: vi.fn().mockResolvedValue({ error: null }) } };
}

describe('POST /api/account/delete', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    deleteUser.mockResolvedValue({ data: null, error: null });
  });

  it('returns 401 when unauthenticated', async () => {
    const { ApiAuthError } = await import('@/lib/api/auth');
    mockRequireUser.mockRejectedValueOnce(new ApiAuthError());
    const res = await POST(makeRequest({ confirm: 'DELETE' }));
    expect(res.status).toBe(401);
  });

  it('returns 400 when confirm string is missing or wrong', async () => {
    mockRequireUser.mockResolvedValue({ supabase: makeSignOutSupabase(), user: { id: USER_ID } as any });
    expect((await POST(makeRequest({}))).status).toBe(400);
    expect((await POST(makeRequest({ confirm: 'delete' }))).status).toBe(400);
    expect((await POST(makeRequest({ confirm: 'YES' }))).status).toBe(400);
    expect(deleteUser).not.toHaveBeenCalled();
  });

  it('calls admin.deleteUser with the caller user_id and returns 200', async () => {
    mockRequireUser.mockResolvedValueOnce({ supabase: makeSignOutSupabase(), user: { id: USER_ID } as any });
    const res = await POST(makeRequest({ confirm: 'DELETE' }));
    expect(res.status).toBe(200);
    expect(deleteUser).toHaveBeenCalledWith(USER_ID);
  });

  it('returns 500 when admin.deleteUser errors', async () => {
    deleteUser.mockResolvedValueOnce({ data: null, error: { message: 'boom' } });
    mockRequireUser.mockResolvedValueOnce({ supabase: makeSignOutSupabase(), user: { id: USER_ID } as any });
    const res = await POST(makeRequest({ confirm: 'DELETE' }));
    expect(res.status).toBe(500);
  });
});
