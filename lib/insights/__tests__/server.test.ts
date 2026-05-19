import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

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

vi.mock('next/cache', () => ({
  unstable_cache: vi.fn((fn: (...args: unknown[]) => unknown) => fn),
}));

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: vi.fn(),
}));

import { unstable_cache } from 'next/cache';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { rowsToKernelInput, getInsightsBundle } from '@/lib/insights/server';

const WORKOUT_ID = 'wk-001';
const EXERCISE_ID = 'ex-bench';
const SET_ID = 'set-001';
const STARTED_AT = '2026-01-05T09:00:00.000Z';

function makeRawRow(overrides?: Partial<Parameters<typeof rowsToKernelInput>[0][number]>) {
  return {
    id: WORKOUT_ID,
    started_at: STARTED_AT,
    status: 'completed',
    workout_exercises: [
      {
        id: 'we-001',
        exercise_id: EXERCISE_ID,
        exercises: { name: 'Bench Press', category: 'chest' },
        sets: [
          {
            id: SET_ID,
            weight_value: 100,
            weight_unit: 'lbs',
            reps: 5,
            logged_at: STARTED_AT,
          },
        ],
      },
    ],
    ...overrides,
  };
}

describe('rowsToKernelInput', () => {
  it('maps a single workout row to WorkoutSample and ExerciseHistorySample', () => {
    const { workouts, allExerciseSamples, exerciseNameById } = rowsToKernelInput([makeRawRow()]);

    expect(workouts).toHaveLength(1);
    expect(workouts[0]).toMatchObject({
      id: WORKOUT_ID,
      startedAt: STARTED_AT,
      status: 'completed',
    });
    expect(workouts[0].exercises).toHaveLength(1);

    expect(allExerciseSamples).toHaveLength(1);
    const sample = allExerciseSamples[0];
    expect(sample.exerciseId).toBe(EXERCISE_ID);
    expect(sample.exerciseName).toBe('Bench Press');
    expect(sample.muscleGroup).toBe('chest');
    expect(sample.workoutId).toBe(WORKOUT_ID);
    expect(sample.workoutDate).toBe(STARTED_AT);
    expect(sample.sets).toHaveLength(1);
    expect(sample.sets[0]).toMatchObject({
      id: SET_ID,
      weight: 100,
      reps: 5,
      weightUnit: 'lbs',
    });

    expect(exerciseNameById.get(EXERCISE_ID)).toBe('Bench Press');
  });

  it('maps weight_value → weight field on SetSample', () => {
    const row = makeRawRow();
    row.workout_exercises[0].sets[0].weight_value = 142.5;
    const { allExerciseSamples } = rowsToKernelInput([row]);
    expect(allExerciseSamples[0].sets[0].weight).toBe(142.5);
  });

  it('skips workout_exercise rows with null exercises (exercise deleted)', () => {
    const row = makeRawRow();
    (row.workout_exercises[0] as any).exercises = null;
    const { allExerciseSamples, workouts } = rowsToKernelInput([row]);
    expect(allExerciseSamples).toHaveLength(0);
    expect(workouts[0].exercises).toHaveLength(0);
  });

  it('collects exercise names across multiple workouts', () => {
    const row1 = makeRawRow();
    const row2 = {
      id: 'wk-002',
      started_at: '2026-01-12T09:00:00.000Z',
      status: 'completed',
      workout_exercises: [
        {
          id: 'we-002',
          exercise_id: 'ex-squat',
          exercises: { name: 'Squat', category: 'legs' },
          sets: [],
        },
      ],
    };

    const { exerciseNameById, allExerciseSamples } = rowsToKernelInput([row1, row2]);

    expect(exerciseNameById.get(EXERCISE_ID)).toBe('Bench Press');
    expect(exerciseNameById.get('ex-squat')).toBe('Squat');
    expect(allExerciseSamples).toHaveLength(2);
  });

  it('handles empty input', () => {
    const result = rowsToKernelInput([]);
    expect(result.workouts).toHaveLength(0);
    expect(result.allExerciseSamples).toHaveLength(0);
    expect(result.exerciseNameById.size).toBe(0);
  });

  it('handles workout with no sets', () => {
    const row = makeRawRow();
    row.workout_exercises[0].sets = [];
    const { allExerciseSamples } = rowsToKernelInput([row]);
    expect(allExerciseSamples[0].sets).toHaveLength(0);
  });

  it('preserves status as-is from the DB row', () => {
    const row = makeRawRow();
    (row as any).status = 'expired';
    const { workouts } = rowsToKernelInput([row]);
    expect(workouts[0].status).toBe('expired');
  });

  it('correctly passes weight_unit through to SetSample', () => {
    const row = makeRawRow();
    row.workout_exercises[0].sets[0].weight_unit = 'kg';
    const { allExerciseSamples } = rowsToKernelInput([row]);
    expect(allExerciseSamples[0].sets[0].weightUnit).toBe('kg');
  });
});

describe('getInsightsBundle cache behavior', () => {
  let cacheStore: Map<string, unknown>;

  beforeEach(() => {
    cacheStore = new Map();
    vi.mocked(unstable_cache).mockImplementation(
      (fn: (...args: unknown[]) => unknown, keyParts: unknown[]) =>
        async () => {
          const key = (keyParts as string[]).join(':');
          if (cacheStore.has(key)) return cacheStore.get(key);
          const result = await (fn as () => Promise<unknown>)();
          cacheStore.set(key, result);
          return result;
        },
    );
  });

  afterEach(() => {
    vi.mocked(unstable_cache).mockImplementation((fn: (...args: unknown[]) => unknown) => fn);
  });

  it('calls the Supabase query once for two identical calls', async () => {
    const mockQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
    };
    const mockFrom = vi.fn().mockReturnValue(mockQuery);
    vi.mocked(createSupabaseServerClient).mockResolvedValue({ from: mockFrom } as any);

    await getInsightsBundle('user-123');
    await getInsightsBundle('user-123');

    expect(mockFrom).toHaveBeenCalledTimes(1);
  });
});
