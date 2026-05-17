import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/env', () => ({ assertServerOnly: () => {} }));

import { withIdempotency, IdempotencyValidationError } from '../server';

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';
const USER_ID = 'aaaa0000-e29b-41d4-a716-446655440000';
const RESOURCE_ID = 'bbbb0000-e29b-41d4-a716-446655440000';

/**
 * Builds a minimal Supabase mock for mutation_receipts.
 *
 * All from() calls return the same { select, insert } shape.
 * maybySingle is a single vi.fn() that returns different values per call count,
 * allowing select→eq→eq→maybySingle to work for both the initial lookup and
 * the post-23505 re-read.
 */
function makeMock({
  existingReceipt = null,
  insertError = null,
  raceReceipt = null,
}: {
  existingReceipt?: Record<string, unknown> | null;
  insertError?: { code: string } | null;
  raceReceipt?: Record<string, unknown> | null;
} = {}) {
  let lookupCallCount = 0;

  const maybeSingle = vi.fn().mockImplementation(async () => {
    lookupCallCount++;
    if (lookupCallCount === 1) return { data: existingReceipt, error: null };
    return { data: raceReceipt, error: null };
  });

  const eqInner = vi.fn().mockReturnValue({ maybeSingle });
  const eqOuter = vi.fn().mockReturnValue({ eq: eqInner });
  const selectFn = vi.fn().mockReturnValue({ eq: eqOuter });
  const insertFn = vi.fn().mockResolvedValue({ error: insertError, data: null });

  const from = vi.fn().mockReturnValue({ select: selectFn, insert: insertFn });

  return { supabase: { from } as any, insertFn, maybeSingle };
}

describe('withIdempotency', () => {
  // (a) Miss path — handler runs once, receipt inserted with correct columns
  it('runs handler exactly once on a cache miss and inserts a receipt with correct columns', async () => {
    const { supabase, insertFn } = makeMock();
    const handler = vi.fn().mockResolvedValue({
      resourceId: RESOURCE_ID,
      response: { id: RESOURCE_ID },
    });

    const result = await withIdempotency({
      supabase,
      userId: USER_ID,
      clientMutationId: VALID_UUID,
      mutationType: 'set.log',
      resourceType: 'sets',
      handler,
    });

    expect(handler).toHaveBeenCalledTimes(1);
    expect(result.replayed).toBe(false);
    expect(result.resourceId).toBe(RESOURCE_ID);
    expect(result.response).toEqual({ id: RESOURCE_ID });

    expect(insertFn).toHaveBeenCalledTimes(1);
    const [insertPayload] = insertFn.mock.calls[0] as [Record<string, unknown>];
    expect(insertPayload).toMatchObject({
      client_mutation_id: VALID_UUID,
      user_id: USER_ID,
      mutation_type: 'set.log',
      resource_type: 'sets',
      resource_id: RESOURCE_ID,
    });
  });

  // (b) Hit path — returns prior resource_id, handler not called
  it('returns the prior resource_id on a cache hit without calling the handler', async () => {
    const existingReceipt = {
      resource_id: RESOURCE_ID,
      mutation_type: 'set.log',
      response_metadata: null,
    };
    const { supabase, insertFn } = makeMock({ existingReceipt });
    const handler = vi.fn();

    const result = await withIdempotency({
      supabase,
      userId: USER_ID,
      clientMutationId: VALID_UUID,
      mutationType: 'set.log',
      resourceType: 'sets',
      handler,
    });

    expect(handler).not.toHaveBeenCalled();
    expect(insertFn).not.toHaveBeenCalled();
    expect(result.replayed).toBe(true);
    expect(result.resourceId).toBe(RESOURCE_ID);
    expect(result.response).toBeNull();
  });

  // (c) Unique-violation on insert → treated as a hit, returns race winner's resource_id
  it('treats a 23505 insert error as a replay and returns the race-winner receipt', async () => {
    const raceReceipt = {
      resource_id: RESOURCE_ID,
      mutation_type: 'set.log',
      response_metadata: null,
    };
    const { supabase, insertFn } = makeMock({
      insertError: { code: '23505' },
      raceReceipt,
    });
    const handler = vi.fn().mockResolvedValue({
      resourceId: RESOURCE_ID,
      response: { id: RESOURCE_ID },
    });

    const result = await withIdempotency({
      supabase,
      userId: USER_ID,
      clientMutationId: VALID_UUID,
      mutationType: 'set.log',
      resourceType: 'sets',
      handler,
    });

    expect(handler).toHaveBeenCalledTimes(1);
    expect(insertFn).toHaveBeenCalledTimes(1);
    expect(result.replayed).toBe(true);
    expect(result.resourceId).toBe(RESOURCE_ID);
    expect(result.response).toBeNull();
  });

  // (d) Invalid clientMutationId — rejects before any DB work
  it('throws IdempotencyValidationError for a non-UUID clientMutationId without touching the DB', async () => {
    const { supabase, insertFn, maybeSingle } = makeMock();
    const handler = vi.fn();

    await expect(
      withIdempotency({
        supabase,
        userId: USER_ID,
        clientMutationId: 'not-a-uuid',
        mutationType: 'set.log',
        resourceType: 'sets',
        handler,
      }),
    ).rejects.toThrow(IdempotencyValidationError);

    expect(handler).not.toHaveBeenCalled();
    expect(insertFn).not.toHaveBeenCalled();
    expect(maybeSingle).not.toHaveBeenCalled();
  });
});
