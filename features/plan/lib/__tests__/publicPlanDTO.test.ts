import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('@/lib/env', () => ({
  assertServerOnly: () => {},
  env: {
    server: {},
    client: {
      NEXT_PUBLIC_SUPABASE_URL: 'http://localhost',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon',
    },
  },
}));

const createSupabaseAnonClient = vi.fn();
vi.mock('@/lib/supabase/server-exports', () => ({
  createSupabaseAnonClient: () => createSupabaseAnonClient(),
}));

import { fetchPublicPlanBySlug } from '../publicPlanDTO';

const SHARE_SLUG = 'abc123-def-ghi';

interface ChainResult {
  data: unknown;
  error: { message: string } | null;
}

function makeSupabase(result: ChainResult) {
  const eqCalls: Array<[string, unknown]> = [];
  const chain: any = {
    select: vi.fn().mockImplementation(() => chain),
    eq: vi.fn().mockImplementation((col: string, val: unknown) => {
      eqCalls.push([col, val]);
      return chain;
    }),
    maybeSingle: vi.fn().mockResolvedValue(result),
  };
  const supabase = {
    from: vi.fn().mockReturnValue(chain),
  };
  return { supabase, eqCalls, chain };
}

beforeEach(() => {
  createSupabaseAnonClient.mockReset();
});

describe('fetchPublicPlanBySlug', () => {
  it('returns null when no row is found', async () => {
    const { supabase } = makeSupabase({ data: null, error: null });
    createSupabaseAnonClient.mockReturnValue(supabase);

    const result = await fetchPublicPlanBySlug(SHARE_SLUG);

    expect(result).toBeNull();
  });

  it('throws when the supabase query errors', async () => {
    const { supabase } = makeSupabase({ data: null, error: { message: 'boom' } });
    createSupabaseAnonClient.mockReturnValue(supabase);

    await expect(fetchPublicPlanBySlug(SHARE_SLUG)).rejects.toThrow('boom');
  });

  it('filters by share_slug and is_public=true', async () => {
    const { supabase, eqCalls } = makeSupabase({ data: null, error: null });
    createSupabaseAnonClient.mockReturnValue(supabase);

    await fetchPublicPlanBySlug(SHARE_SLUG);

    expect(eqCalls).toEqual(
      expect.arrayContaining([
        ['share_slug', SHARE_SLUG],
        ['is_public', true],
      ]),
    );
  });

  it('sorts workouts and exercises by position and maps to camelCase', async () => {
    const { supabase } = makeSupabase({
      data: {
        id: 'plan-1',
        name: 'Strength',
        share_slug: SHARE_SLUG,
        updated_at: '2026-05-09T00:00:00Z',
        plan_workouts: [
          {
            id: 'wk-2',
            name: 'Day B',
            position: 1,
            plan_exercises: [
              {
                id: 'ex-2',
                target_sets: 4,
                target_reps: 6,
                position: 1,
                exercises: { name: 'Row' },
              },
              {
                id: 'ex-1',
                target_sets: 3,
                target_reps: 5,
                position: 0,
                exercises: { name: 'Squat' },
              },
            ],
          },
          {
            id: 'wk-1',
            name: 'Day A',
            position: 0,
            plan_exercises: [
              {
                id: 'ex-3',
                target_sets: 5,
                target_reps: 3,
                position: 0,
                exercises: { name: 'Deadlift' },
              },
            ],
          },
        ],
      },
      error: null,
    });
    createSupabaseAnonClient.mockReturnValue(supabase);

    const result = await fetchPublicPlanBySlug(SHARE_SLUG);

    expect(result).not.toBeNull();
    expect(result!).toEqual({
      id: 'plan-1',
      name: 'Strength',
      shareSlug: SHARE_SLUG,
      updatedAt: '2026-05-09T00:00:00Z',
      workouts: [
        {
          id: 'wk-1',
          name: 'Day A',
          position: 0,
          exercises: [
            {
              id: 'ex-3',
              exerciseName: 'Deadlift',
              targetSets: 5,
              targetReps: 3,
              position: 0,
            },
          ],
        },
        {
          id: 'wk-2',
          name: 'Day B',
          position: 1,
          exercises: [
            {
              id: 'ex-1',
              exerciseName: 'Squat',
              targetSets: 3,
              targetReps: 5,
              position: 0,
            },
            {
              id: 'ex-2',
              exerciseName: 'Row',
              targetSets: 4,
              targetReps: 6,
              position: 1,
            },
          ],
        },
      ],
    });
  });

  it("falls back to 'Unknown exercise' when the joined exercise row is missing", async () => {
    const { supabase } = makeSupabase({
      data: {
        id: 'plan-1',
        name: 'Strength',
        share_slug: SHARE_SLUG,
        updated_at: '2026-05-09T00:00:00Z',
        plan_workouts: [
          {
            id: 'wk-1',
            name: 'Day A',
            position: 0,
            plan_exercises: [
              {
                id: 'ex-1',
                target_sets: 3,
                target_reps: 5,
                position: 0,
                exercises: null,
              },
            ],
          },
        ],
      },
      error: null,
    });
    createSupabaseAnonClient.mockReturnValue(supabase);

    const result = await fetchPublicPlanBySlug(SHARE_SLUG);

    expect(result!.workouts[0]?.exercises[0]?.exerciseName).toBe('Unknown exercise');
  });

  it('handles plans with no workouts or null arrays', async () => {
    const { supabase } = makeSupabase({
      data: {
        id: 'plan-1',
        name: 'Empty',
        share_slug: SHARE_SLUG,
        updated_at: '2026-05-09T00:00:00Z',
        plan_workouts: null,
      },
      error: null,
    });
    createSupabaseAnonClient.mockReturnValue(supabase);

    const result = await fetchPublicPlanBySlug(SHARE_SLUG);

    expect(result!.workouts).toEqual([]);
  });
});
