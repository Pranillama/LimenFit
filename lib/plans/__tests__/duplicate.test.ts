import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/env', () => ({ assertServerOnly: () => {} }));
vi.mock('@/lib/idempotency', () => ({
  newClientMutationId: () => 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
}));

import { duplicatePlanForUser, PlanNotFoundError } from '../duplicate';

const SOURCE_PLAN_ID = '11111111-0000-4000-8000-000000000001';
const TARGET_USER_ID = '22222222-0000-4000-8000-000000000002';
const NEW_PLAN_ID    = '33333333-0000-4000-8000-000000000003';
const SHARE_SLUG     = 'abc-def-ghi';

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
      plan_exercises: [
        { exercise_id: 'ex-row', target_sets: 4, target_reps: 6, position: 0 },
      ],
    },
  ],
};

function makeSupabaseMock({
  planRow = PLAN_ROW as typeof PLAN_ROW | null,
  selectError = null as { message: string } | null,
  rpcResult = [{ plan_id: NEW_PLAN_ID, share_slug: SHARE_SLUG }] as Array<{ plan_id: string; share_slug: string }>,
  rpcError = null as { message: string } | null,
} = {}) {
  const rpc = vi.fn().mockResolvedValue({ data: rpcResult, error: rpcError });

  const maybeSingle = vi.fn().mockResolvedValue({ data: planRow, error: selectError });
  const select = vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ maybeSingle }) });
  const from = vi.fn().mockReturnValue({ select });

  return { supabase: { from, rpc } as any, rpc, maybeSingle };
}

describe('duplicatePlanForUser', () => {
  it('returns planId and shareSlug from RPC on happy path', async () => {
    const { supabase } = makeSupabaseMock();

    const result = await duplicatePlanForUser(supabase, {
      sourcePlanId: SOURCE_PLAN_ID,
      targetUserId: TARGET_USER_ID,
    });

    expect(result).toEqual({ planId: NEW_PLAN_ID, shareSlug: SHARE_SLUG });
  });

  it('calls create_plan_with_children RPC with correct snake_case JSON payload', async () => {
    const { supabase, rpc } = makeSupabaseMock();

    await duplicatePlanForUser(supabase, {
      sourcePlanId: SOURCE_PLAN_ID,
      targetUserId: TARGET_USER_ID,
    });

    expect(rpc).toHaveBeenCalledTimes(1);
    const [rpcName, args] = rpc.mock.calls[0] as [string, Record<string, unknown>];
    expect(rpcName).toBe('create_plan_with_children');
    expect(args.p_name).toBe('My Strength Plan');
    expect(args.p_client_mutation_id).toBe('aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee');

    const workouts = args.p_workouts as Array<Record<string, unknown>>;
    expect(workouts).toHaveLength(2);

    expect(workouts[0]).toMatchObject({ name: 'Day A', position: 0 });
    const exercises0 = workouts[0].exercises as Array<Record<string, unknown>>;
    expect(exercises0[0]).toMatchObject({
      exercise_id: 'ex-squat',
      target_sets: 3,
      target_reps: 5,
      position: 0,
    });
    expect(exercises0[1]).toMatchObject({
      exercise_id: 'ex-bench',
      target_sets: 3,
      target_reps: 8,
      position: 1,
    });

    expect(workouts[1]).toMatchObject({ name: 'Day B', position: 1 });
    const exercises1 = workouts[1].exercises as Array<Record<string, unknown>>;
    expect(exercises1[0]).toMatchObject({
      exercise_id: 'ex-row',
      target_sets: 4,
      target_reps: 6,
      position: 0,
    });
  });

  it('throws PlanNotFoundError when SELECT returns null', async () => {
    const { supabase } = makeSupabaseMock({ planRow: null });

    await expect(
      duplicatePlanForUser(supabase, {
        sourcePlanId: SOURCE_PLAN_ID,
        targetUserId: TARGET_USER_ID,
      }),
    ).rejects.toThrow(PlanNotFoundError);
  });

  it('throws PlanNotFoundError with the source plan id in the message', async () => {
    const { supabase } = makeSupabaseMock({ planRow: null });

    await expect(
      duplicatePlanForUser(supabase, {
        sourcePlanId: SOURCE_PLAN_ID,
        targetUserId: TARGET_USER_ID,
      }),
    ).rejects.toThrow(SOURCE_PLAN_ID);
  });

  it('propagates RPC errors as thrown errors', async () => {
    const { supabase } = makeSupabaseMock({
      rpcResult: [],
      rpcError: { message: 'database error' },
    });

    await expect(
      duplicatePlanForUser(supabase, {
        sourcePlanId: SOURCE_PLAN_ID,
        targetUserId: TARGET_USER_ID,
      }),
    ).rejects.toThrow('database error');
  });

  it('does not call RPC when the source plan is not found', async () => {
    const { supabase, rpc } = makeSupabaseMock({ planRow: null });

    await expect(
      duplicatePlanForUser(supabase, {
        sourcePlanId: SOURCE_PLAN_ID,
        targetUserId: TARGET_USER_ID,
      }),
    ).rejects.toThrow(PlanNotFoundError);

    expect(rpc).not.toHaveBeenCalled();
  });
});
