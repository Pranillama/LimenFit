import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/env', () => ({ assertServerOnly: () => {} }));
vi.mock('@/lib/idempotency', () => ({
  newClientMutationId: () => 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
}));

import { duplicatePlanForUser, PlanNotFoundError } from '../duplicate';

const SOURCE_PLAN_ID = '11111111-0000-4000-8000-000000000001';
const TARGET_USER_ID = '22222222-0000-4000-8000-000000000002';
const NEW_PLAN_ID = '33333333-0000-4000-8000-000000000003';
const EXISTING_PLAN_ID = '44444444-0000-4000-8000-000000000004';
const SHARE_SLUG = 'abc-def-ghi';
const EXISTING_SHARE_SLUG = 'race-winner-slug';
const REQUEST_MUTATION_ID = '550e8400-e29b-41d4-a716-446655440000';

const PLAN_ROW = {
  id: SOURCE_PLAN_ID,
  name: 'My Strength Plan',
  plan_workouts: [
    {
      id: 'wk-1',
      name: 'Day A',
      position: 0,
      plan_exercises: [
        { exercise_id: 'ex-squat', target_sets: 3, target_reps: 5, position: 0 },
        { exercise_id: 'ex-bench', target_sets: 3, target_reps: 8, position: 1 },
      ],
    },
    {
      id: 'wk-2',
      name: 'Day B',
      position: 1,
      plan_exercises: [{ exercise_id: 'ex-row', target_sets: 4, target_reps: 6, position: 0 }],
    },
  ],
};

/**
 * Builds a chained `.from(...).select(...).eq(...).eq(...).maybeSingle()` mock that
 * supports multiple sequential `.eq` calls and per-call `from(...)` results.
 *
 * `fromResults` is a queue: each `.from()` call shifts the next entry. An entry
 * may be a row, `null`, or a `{ data, error }` shape. `rpcResult` / `rpcError`
 * configure the single `supabase.rpc` mock.
 */
function makeSupabaseMock({
  fromResults = [PLAN_ROW] as Array<unknown>,
  rpcResult = [{ plan_id: NEW_PLAN_ID, share_slug: SHARE_SLUG }] as Array<{
    plan_id: string;
    share_slug: string;
  }>,
  rpcError = null as { message: string; code?: string } | null,
} = {}) {
  const fromCalls: any[] = [];
  const rpc = vi.fn().mockResolvedValue({ data: rpcResult, error: rpcError });

  const from = vi.fn().mockImplementation((table: string) => {
    const next = fromResults.shift();
    const result =
      next && typeof next === 'object' && ('data' in next || 'error' in next)
        ? (next as { data: unknown; error: unknown })
        : { data: next ?? null, error: null };

    const chain: any = {
      _table: table,
      _eqCalls: [] as Array<[string, unknown]>,
      select: vi.fn(function (this: any, cols: string) {
        this._select = cols;
        return chain;
      }),
      eq: vi.fn(function (this: any, col: string, val: unknown) {
        this._eqCalls.push([col, val]);
        return chain;
      }),
      maybeSingle: vi.fn().mockResolvedValue(result),
    };
    fromCalls.push(chain);
    return chain;
  });

  return { supabase: { from, rpc } as any, rpc, from, fromCalls };
}

describe('duplicatePlanForUser', () => {
  it('returns planId and shareSlug from RPC on happy path', async () => {
    const { supabase } = makeSupabaseMock();

    const result = await duplicatePlanForUser(supabase, {
      sourcePlanId: SOURCE_PLAN_ID,
      targetUserId: TARGET_USER_ID,
      clientMutationId: REQUEST_MUTATION_ID,
    });

    expect(result).toEqual({ planId: NEW_PLAN_ID, shareSlug: SHARE_SLUG });
  });

  it('passes the request clientMutationId to create_plan_with_children (does NOT generate a fresh id)', async () => {
    const { supabase, rpc } = makeSupabaseMock();

    await duplicatePlanForUser(supabase, {
      sourcePlanId: SOURCE_PLAN_ID,
      targetUserId: TARGET_USER_ID,
      clientMutationId: REQUEST_MUTATION_ID,
    });

    expect(rpc).toHaveBeenCalledTimes(1);
    const [rpcName, args] = rpc.mock.calls[0] as [string, Record<string, unknown>];
    expect(rpcName).toBe('create_plan_with_children');
    expect(args.p_client_mutation_id).toBe(REQUEST_MUTATION_ID);
    // Sanity: it is NOT the value newClientMutationId() would have produced.
    expect(args.p_client_mutation_id).not.toBe('aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee');
  });

  it('calls create_plan_with_children RPC with correct snake_case JSON payload', async () => {
    const { supabase, rpc } = makeSupabaseMock();

    await duplicatePlanForUser(supabase, {
      sourcePlanId: SOURCE_PLAN_ID,
      targetUserId: TARGET_USER_ID,
      clientMutationId: REQUEST_MUTATION_ID,
    });

    expect(rpc).toHaveBeenCalledTimes(1);
    const [rpcName, args] = rpc.mock.calls[0] as [string, Record<string, unknown>];
    expect(rpcName).toBe('create_plan_with_children');
    expect(args.p_name).toBe('My Strength Plan');
    expect(args.p_client_mutation_id).toBe(REQUEST_MUTATION_ID);

    const workouts = args.p_workouts as Array<Record<string, unknown>>;
    expect(workouts).toHaveLength(2);

    expect(workouts[0]).toMatchObject({ name: 'Day A', position: 0 });
    const exercises0 = workouts[0]!.exercises as Array<Record<string, unknown>>;
    expect(exercises0[0]!).toMatchObject({
      exercise_id: 'ex-squat',
      target_sets: 3,
      target_reps: 5,
      position: 0,
    });
    expect(exercises0[1]!).toMatchObject({
      exercise_id: 'ex-bench',
      target_sets: 3,
      target_reps: 8,
      position: 1,
    });

    expect(workouts[1]).toMatchObject({ name: 'Day B', position: 1 });
    const exercises1 = workouts[1]!.exercises as Array<Record<string, unknown>>;
    expect(exercises1[0]!).toMatchObject({
      exercise_id: 'ex-row',
      target_sets: 4,
      target_reps: 6,
      position: 0,
    });
  });

  it('throws PlanNotFoundError when SELECT returns null', async () => {
    const { supabase } = makeSupabaseMock({ fromResults: [null] });

    await expect(
      duplicatePlanForUser(supabase, {
        sourcePlanId: SOURCE_PLAN_ID,
        targetUserId: TARGET_USER_ID,
        clientMutationId: REQUEST_MUTATION_ID,
      }),
    ).rejects.toThrow(PlanNotFoundError);
  });

  it('throws PlanNotFoundError with the source plan id in the message', async () => {
    const { supabase } = makeSupabaseMock({ fromResults: [null] });

    await expect(
      duplicatePlanForUser(supabase, {
        sourcePlanId: SOURCE_PLAN_ID,
        targetUserId: TARGET_USER_ID,
        clientMutationId: REQUEST_MUTATION_ID,
      }),
    ).rejects.toThrow(SOURCE_PLAN_ID);
  });

  it('propagates non-23505 RPC errors as thrown errors', async () => {
    const { supabase } = makeSupabaseMock({
      rpcResult: [],
      rpcError: { message: 'database error', code: '42P01' },
    });

    await expect(
      duplicatePlanForUser(supabase, {
        sourcePlanId: SOURCE_PLAN_ID,
        targetUserId: TARGET_USER_ID,
        clientMutationId: REQUEST_MUTATION_ID,
      }),
    ).rejects.toThrow('database error');
  });

  it('does not call RPC when the source plan is not found', async () => {
    const { supabase, rpc } = makeSupabaseMock({ fromResults: [null] });

    await expect(
      duplicatePlanForUser(supabase, {
        sourcePlanId: SOURCE_PLAN_ID,
        targetUserId: TARGET_USER_ID,
        clientMutationId: REQUEST_MUTATION_ID,
      }),
    ).rejects.toThrow(PlanNotFoundError);

    expect(rpc).not.toHaveBeenCalled();
  });

  it('recovers from rpcError 23505 by selecting existing plan by (client_mutation_id, user_id)', async () => {
    const { supabase, fromCalls } = makeSupabaseMock({
      fromResults: [PLAN_ROW, { id: EXISTING_PLAN_ID, share_slug: EXISTING_SHARE_SLUG }],
      rpcResult: [],
      rpcError: { message: 'duplicate key value violates unique constraint', code: '23505' },
    });

    const result = await duplicatePlanForUser(supabase, {
      sourcePlanId: SOURCE_PLAN_ID,
      targetUserId: TARGET_USER_ID,
      clientMutationId: REQUEST_MUTATION_ID,
    });

    expect(result).toEqual({ planId: EXISTING_PLAN_ID, shareSlug: EXISTING_SHARE_SLUG });

    // Second `from('plans')` call is the fallback SELECT — assert it filters
    // by both client_mutation_id and user_id so concurrent handlers converge.
    expect(fromCalls).toHaveLength(2);
    const fallback = fromCalls[1];
    expect(fallback._table).toBe('plans');
    expect(fallback._eqCalls).toEqual(
      expect.arrayContaining([
        ['client_mutation_id', REQUEST_MUTATION_ID],
        ['user_id', TARGET_USER_ID],
      ]),
    );
  });

  it('throws the original 23505 error if the fallback SELECT returns no row', async () => {
    const { supabase } = makeSupabaseMock({
      fromResults: [PLAN_ROW, null],
      rpcResult: [],
      rpcError: { message: 'duplicate key', code: '23505' },
    });

    await expect(
      duplicatePlanForUser(supabase, {
        sourcePlanId: SOURCE_PLAN_ID,
        targetUserId: TARGET_USER_ID,
        clientMutationId: REQUEST_MUTATION_ID,
      }),
    ).rejects.toThrow('duplicate key');
  });
});
