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

vi.mock('@/lib/insights/server', () => ({
  getInsightsBundle: vi.fn(),
  rowsToKernelInput: vi.fn(),
}));

import {
  READONLY_TOOLS,
  dispatchToolCall,
  ToolNotFoundError,
  ToolValidationError,
} from '@/lib/ai/tools';
import { getInsightsBundle, rowsToKernelInput } from '@/lib/insights/server';

const USER_ID = 'user-aaa0-0000-0000-000000000000';
const EXERCISE_ID = '770e8400-e29b-41d4-a716-446655440000';
const STARTED_AT = '2026-01-12T09:00:00.000Z';
const NOW = new Date('2026-01-19T12:00:00.000Z');

function makeRawRow(
  overrides: Partial<{
    id: string;
    started_at: string;
    status: string;
    workout_exercises: any[];
  }> = {},
) {
  return {
    id: 'wk-001',
    started_at: STARTED_AT,
    status: 'completed',
    workout_exercises: [
      {
        id: 'we-001',
        exercise_id: EXERCISE_ID,
        exercises: { name: 'Bench Press', category: 'chest' },
        sets: [{ id: 's1', weight_value: 100, weight_unit: 'lbs', reps: 5, logged_at: STARTED_AT }],
      },
    ],
    ...overrides,
  };
}

/** Mock-builder modeled on `makeExerciseQuery` in lib/insights/__tests__/server.test.ts */
function makeExerciseQuery(rows: any[]) {
  const orderResolver = vi.fn().mockResolvedValue({ data: rows, error: null });
  const builder: any = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    order: orderResolver,
    limit: vi.fn().mockReturnThis(),
  };
  const supabase: any = {
    from: vi.fn().mockReturnValue(builder),
  };
  return { supabase, builder, orderResolver };
}

function makeSetsQuery(rows: any[]) {
  const builder: any = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue({ data: rows, error: null }),
  };
  const supabase: any = { from: vi.fn().mockReturnValue(builder) };
  return { supabase, builder };
}

beforeEach(() => {
  vi.clearAllMocks();
  // Default rowsToKernelInput passthrough — translates raw rows shaped like makeRawRow
  // into the kernel input shape consumed by handleGetExerciseHistory.
  vi.mocked(rowsToKernelInput).mockImplementation((rows: any[]) => {
    const exerciseNameById = new Map<string, string>();
    const allExerciseSamples = rows.flatMap((row) =>
      row.workout_exercises.flatMap((we: any) => {
        if (!we.exercises) return [];
        exerciseNameById.set(we.exercise_id, we.exercises.name);
        return [
          {
            exerciseId: we.exercise_id,
            exerciseName: we.exercises.name,
            muscleGroup: we.exercises.category,
            sets: we.sets.map((s: any) => ({
              id: s.id,
              weight: s.weight_value,
              reps: s.reps,
              weightUnit: s.weight_unit,
            })),
            workoutId: row.id,
            workoutDate: row.started_at,
          },
        ];
      }),
    );
    const workouts = rows.map((row) => ({
      id: row.id,
      startedAt: row.started_at,
      status: row.status,
      exercises: [],
    }));
    return { workouts, allExerciseSamples, exerciseNameById };
  });
});

// ---------------------------------------------------------------------------
// READONLY_TOOLS registry — the AC's "no write tools" guarantee
// ---------------------------------------------------------------------------

describe('READONLY_TOOLS registry', () => {
  it('exposes exactly the four read-only tools — no write tools', () => {
    expect(Object.keys(READONLY_TOOLS)).toEqual([
      'get_exercise_history',
      'search_sets_by_criteria',
      'get_personal_records',
      'get_recent_workouts',
    ]);
  });
});

// ---------------------------------------------------------------------------
// get_exercise_history
// ---------------------------------------------------------------------------

describe('get_exercise_history', () => {
  it('returns one session per workout with e1rm and top-set summaries (happy path)', async () => {
    const { supabase } = makeExerciseQuery([makeRawRow()]);

    const result = (await dispatchToolCall(
      'get_exercise_history',
      { exerciseId: EXERCISE_ID, days: 90 },
      { supabase, userId: USER_ID, now: NOW },
    )) as any;

    expect(result.exerciseId).toBe(EXERCISE_ID);
    expect(result.exerciseName).toBe('Bench Press');
    expect(result.sessions).toHaveLength(1);
    expect(result.sessions[0].topSetWeight).toBe(100);
    expect(result.sessions[0].topSetReps).toBe(5);
    expect(result.sessions[0].sets[0]).toMatchObject({ weight: 100, reps: 5, unit: 'lbs' });
  });

  it('returns an empty session list when the user has no matching workouts (empty case)', async () => {
    const { supabase } = makeExerciseQuery([]);

    const result = (await dispatchToolCall(
      'get_exercise_history',
      { exerciseId: EXERCISE_ID, days: 30 },
      { supabase, userId: USER_ID, now: NOW },
    )) as any;

    expect(result.sessions).toHaveLength(0);
    expect(result.exerciseName).toBe('');
  });
});

// ---------------------------------------------------------------------------
// search_sets_by_criteria
// ---------------------------------------------------------------------------

describe('search_sets_by_criteria', () => {
  it('maps DB rows to SearchSetMatch with exercise name and workout date (happy path)', async () => {
    const row = {
      id: 'set-1',
      weight_value: 225,
      weight_unit: 'lbs',
      reps: 5,
      logged_at: STARTED_AT,
      workout_exercises: {
        exercises: { id: EXERCISE_ID, name: 'Squat' },
        workouts: { id: 'wk-1', started_at: STARTED_AT },
      },
    };
    const { supabase } = makeSetsQuery([row]);

    const result = (await dispatchToolCall(
      'search_sets_by_criteria',
      { weightGte: 200, limit: 5 },
      { supabase, userId: USER_ID, now: NOW },
    )) as any[];

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      setId: 'set-1',
      exerciseName: 'Squat',
      weight: 225,
      reps: 5,
      unit: 'lbs',
      workoutDate: STARTED_AT,
    });
  });

  it('returns [] when no sets match the filters (empty case)', async () => {
    const { supabase } = makeSetsQuery([]);
    const result = (await dispatchToolCall(
      'search_sets_by_criteria',
      { weightGte: 999 },
      { supabase, userId: USER_ID, now: NOW },
    )) as any[];
    expect(result).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// get_personal_records
// ---------------------------------------------------------------------------

describe('get_personal_records', () => {
  it('returns the bundle.personalRecords as-is when no exerciseId filter (happy path)', async () => {
    const pr = {
      exerciseId: EXERCISE_ID,
      exerciseName: 'Bench Press',
      workoutDate: STARTED_AT,
      topSetWeight: 200,
      topSetReps: 3,
      e1rm: 220,
      weightUnit: 'lbs',
      priorBestE1rm: 210,
    };
    vi.mocked(getInsightsBundle).mockResolvedValueOnce({
      personalRecords: [pr],
    } as any);

    const result = (await dispatchToolCall(
      'get_personal_records',
      {},
      { supabase: {} as any, userId: USER_ID, now: NOW },
    )) as any[];

    expect(result).toEqual([pr]);
  });

  it('returns [] when the user has no PRs (empty case)', async () => {
    vi.mocked(getInsightsBundle).mockResolvedValueOnce({ personalRecords: [] } as any);

    const result = (await dispatchToolCall(
      'get_personal_records',
      {},
      { supabase: {} as any, userId: USER_ID, now: NOW },
    )) as any[];

    expect(result).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// get_recent_workouts
// ---------------------------------------------------------------------------

describe('get_recent_workouts', () => {
  it('summarizes recent workouts with exercise counts and names (happy path)', async () => {
    const row = {
      id: 'wk-1',
      name: 'Push Day',
      started_at: STARTED_AT,
      completed_at: '2026-01-12T10:00:00.000Z',
      status: 'completed',
      workout_exercises: [
        {
          id: 'we-1',
          exercise_id: EXERCISE_ID,
          position: 0,
          exercises: { name: 'Bench Press' },
          sets: [{ id: 's1' }, { id: 's2' }, { id: 's3' }],
        },
      ],
    };
    const { supabase } = makeExerciseQuery([row]);

    const result = (await dispatchToolCall(
      'get_recent_workouts',
      { days: 7 },
      { supabase, userId: USER_ID, now: NOW },
    )) as any[];

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: 'wk-1',
      name: 'Push Day',
      exerciseCount: 1,
      setCount: 3,
      exerciseNames: ['Bench Press'],
    });
    expect(result[0].durationMs).toBeGreaterThan(0);
  });

  it('returns [] when the user has no recent workouts (empty case)', async () => {
    const { supabase } = makeExerciseQuery([]);
    const result = (await dispatchToolCall(
      'get_recent_workouts',
      { days: 14 },
      { supabase, userId: USER_ID, now: NOW },
    )) as any[];
    expect(result).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// dispatchToolCall — error and validation paths
// ---------------------------------------------------------------------------

describe('dispatchToolCall', () => {
  it('throws ToolNotFoundError for an unknown tool name', async () => {
    await expect(
      dispatchToolCall('does_not_exist', {}, { supabase: {} as any, userId: USER_ID }),
    ).rejects.toBeInstanceOf(ToolNotFoundError);
  });

  it('throws ToolValidationError when args fail schema validation', async () => {
    await expect(
      dispatchToolCall(
        'get_exercise_history',
        { exerciseId: 'not-a-uuid' },
        { supabase: {} as any, userId: USER_ID },
      ),
    ).rejects.toBeInstanceOf(ToolValidationError);
  });

  it('dispatches successfully and returns the handler payload', async () => {
    vi.mocked(getInsightsBundle).mockResolvedValueOnce({ personalRecords: [] } as any);

    const result = await dispatchToolCall(
      'get_personal_records',
      {},
      { supabase: {} as any, userId: USER_ID },
    );

    expect(Array.isArray(result)).toBe(true);
    expect(getInsightsBundle).toHaveBeenCalledWith(USER_ID, expect.any(Object));
  });
});
