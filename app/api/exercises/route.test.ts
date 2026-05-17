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
const RESOURCE_ID = '880e8400-e29b-41d4-a716-446655440000';
const USER_ID = 'user-aaa0-0000-0000-000000000000';

function makeRequest(): Request {
  return new Request('http://localhost/api/exercises', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      clientMutationId: CLIENT_MUTATION_ID,
      name: 'Push-up',
      category: 'chest',
      equipment: null,
    }),
  });
}

function makeReplaySupabase(): any {
  return {
    from: vi.fn((_table: string) => ({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: {
              id: RESOURCE_ID,
              name: 'Push-up',
              category: 'chest',
              equipment: null,
              is_custom: true,
            },
            error: null,
          }),
        }),
      }),
    })),
  };
}

describe('POST /api/exercises', () => {
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
      supabase: makeReplaySupabase(),
      user: { id: USER_ID } as any,
    });

    const req = new Request('http://localhost/api/exercises', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientMutationId: CLIENT_MUTATION_ID, name: 'Push-up' }),
    });

    const res = await POST(req);

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error.code).toBe('VALIDATION_ERROR');
    expect(mockWithIdempotency).not.toHaveBeenCalled();
  });

  it('returns 200 with full response shape on replay', async () => {
    mockRequireUser.mockResolvedValueOnce({
      supabase: makeReplaySupabase(),
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
    expect(json.name).toBe('Push-up');
    expect(json.category).toBe('chest');
    expect(json.equipment).toBeNull();
    expect(json.isCustom).toBe(true);
  });

  it('returns 201 with full response shape on first call', async () => {
    mockRequireUser.mockResolvedValueOnce({
      supabase: makeReplaySupabase(),
      user: { id: USER_ID } as any,
    });
    mockWithIdempotency.mockResolvedValueOnce({
      replayed: false,
      resourceId: RESOURCE_ID,
      response: {
        id: RESOURCE_ID,
        clientMutationId: CLIENT_MUTATION_ID,
        name: 'Push-up',
        category: 'chest',
        equipment: null,
        isCustom: true,
      },
    });

    const res = await POST(makeRequest());

    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.id).toBe(RESOURCE_ID);
    expect(json.clientMutationId).toBe(CLIENT_MUTATION_ID);
    expect(json.name).toBe('Push-up');
    expect(json.category).toBe('chest');
    expect(json.equipment).toBeNull();
    expect(json.isCustom).toBe(true);
  });

  it('recovers from concurrent exercises insert by fetching existing row on 23505', async () => {
    let exerciseInsertCount = 0;

    const supabase: any = {
      from: (_table: string) => ({
        insert: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn(() => {
              exerciseInsertCount++;
              if (exerciseInsertCount === 1) {
                return Promise.resolve({
                  data: {
                    id: RESOURCE_ID,
                    name: 'Push-up',
                    category: 'chest',
                    equipment: null,
                    is_custom: true,
                  },
                  error: null,
                });
              }
              return Promise.resolve({
                data: null,
                error: { code: '23505', message: 'duplicate key value violates unique constraint' },
              });
            }),
          })),
        })),
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(() =>
              Promise.resolve({
                data: {
                  id: RESOURCE_ID,
                  name: 'Push-up',
                  category: 'chest',
                  equipment: null,
                  is_custom: true,
                },
                error: null,
              }),
            ),
          })),
        })),
      }),
    };

    mockRequireUser.mockResolvedValue({ supabase, user: { id: USER_ID } as any });

    // Both requests enter handler() — simulates the pre-receipt race
    mockWithIdempotency.mockImplementation(async (opts: any) => {
      const r = await opts.handler();
      return { replayed: false, resourceId: r.resourceId, response: r.response };
    });

    const [res1, res2] = await Promise.all([POST(makeRequest()), POST(makeRequest())]);

    expect(exerciseInsertCount).toBe(2);
    expect(res1.status).toBe(201);
    expect(res2.status).toBe(201);
    const [json1, json2] = await Promise.all([res1.json(), res2.json()]);
    expect(json1.id).toBe(RESOURCE_ID);
    expect(json2.id).toBe(RESOURCE_ID);
    expect(json1.clientMutationId).toBe(CLIENT_MUTATION_ID);
    expect(json2.clientMutationId).toBe(CLIENT_MUTATION_ID);
  });

  it('two POSTs with the same clientMutationId insert once and return identical bodies', async () => {
    const insertSpy = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: {
            id: RESOURCE_ID,
            name: 'Push-up',
            category: 'chest',
            equipment: null,
            is_custom: true,
          },
          error: null,
        }),
      }),
    });

    const supabase: any = {
      from: (_table: string) => ({
        insert: insertSpy,
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: {
                id: RESOURCE_ID,
                name: 'Push-up',
                category: 'chest',
                equipment: null,
                is_custom: true,
              },
              error: null,
            }),
          }),
        }),
      }),
    };

    mockRequireUser.mockResolvedValue({
      supabase,
      user: { id: USER_ID } as any,
    });

    let capturedResult: { resourceId: string | null; response: any } | null = null;
    mockWithIdempotency.mockImplementation(async (opts: any) => {
      if (capturedResult === null) {
        const r = await opts.handler();
        capturedResult = r;
        return { replayed: false, resourceId: r.resourceId, response: r.response };
      }
      return { replayed: true, resourceId: capturedResult.resourceId, response: null };
    });

    const res1 = await POST(makeRequest());
    const json1 = await res1.json();

    const res2 = await POST(makeRequest());
    const json2 = await res2.json();

    expect(insertSpy).toHaveBeenCalledTimes(1);
    expect(json1.id).toBe(json2.id);
    expect(json1.clientMutationId).toBe(json2.clientMutationId);
    expect(json1.name).toBe(json2.name);
    expect(json1.isCustom).toBe(true);
    expect(json2.isCustom).toBe(true);
  });
});
