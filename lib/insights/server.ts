import { unstable_cache } from 'next/cache';

import { assertServerOnly } from '@/lib/env';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import type {
  ExerciseHistorySample,
  InsightMessage,
  InsightsBundle,
  MuscleGroup,
  OneRepMaxPoint,
  SetSample,
  WeightUnit,
  WorkoutSample,
} from '@/features/insights/lib/types';
import { computeOneRepMaxSeries } from '@/features/insights/lib/oneRepMax';
import { computeVolumeTrend } from '@/features/insights/lib/volumeTrend';
import { computeConsistencyScore } from '@/features/insights/lib/consistency';
import { detectPlateaus } from '@/features/insights/lib/plateau';
import { generateInsightMessages } from '@/features/insights/lib/messages';

assertServerOnly();

export const INSIGHTS_LOOKBACK_WEEKS = 26;

export function insightsTag(userId: string): string {
  return `insights:${userId}`;
}

// ---------------------------------------------------------------------------
// Raw DB row shapes (matches the nested Supabase select below)
// ---------------------------------------------------------------------------

type RawSet = {
  id: string;
  weight_value: number;
  weight_unit: string;
  reps: number;
  logged_at: string;
};

type RawWorkoutExercise = {
  id: string;
  exercise_id: string;
  exercises: { name: string; category: string } | null;
  sets: RawSet[];
};

type RawWorkoutRow = {
  id: string;
  started_at: string;
  status: string;
  workout_exercises: RawWorkoutExercise[];
};

// ---------------------------------------------------------------------------
// Pure mapper — exported so unit tests can exercise it without Supabase
// ---------------------------------------------------------------------------

export function rowsToKernelInput(rows: RawWorkoutRow[]): {
  workouts: WorkoutSample[];
  allExerciseSamples: ExerciseHistorySample[];
  exerciseNameById: Map<string, string>;
} {
  const exerciseNameById = new Map<string, string>();
  const workouts: WorkoutSample[] = [];
  const allExerciseSamples: ExerciseHistorySample[] = [];

  for (const row of rows) {
    const exercises: ExerciseHistorySample[] = [];

    for (const we of row.workout_exercises) {
      if (!we.exercises) continue;

      exerciseNameById.set(we.exercise_id, we.exercises.name);

      const sets: SetSample[] = we.sets.map((s) => ({
        id: s.id,
        weight: s.weight_value,
        reps: s.reps,
        weightUnit: s.weight_unit as WeightUnit,
      }));

      const sample: ExerciseHistorySample = {
        exerciseId: we.exercise_id,
        exerciseName: we.exercises.name,
        muscleGroup: we.exercises.category as MuscleGroup,
        sets,
        workoutId: row.id,
        workoutDate: row.started_at,
      };

      exercises.push(sample);
      allExerciseSamples.push(sample);
    }

    workouts.push({
      id: row.id,
      startedAt: row.started_at,
      status: row.status as 'completed' | 'expired',
      exercises,
    });
  }

  return { workouts, allExerciseSamples, exerciseNameById };
}

// ---------------------------------------------------------------------------
// Internal fetch helpers (not exported — tested indirectly)
// ---------------------------------------------------------------------------

type SupabaseServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

function computeLookbackDate(now: Date): Date {
  return new Date(now.getTime() - INSIGHTS_LOOKBACK_WEEKS * 7 * 24 * 60 * 60 * 1000);
}

async function fetchWorkoutRows(
  supabase: SupabaseServerClient,
  userId: string,
  now: Date,
): Promise<RawWorkoutRow[]> {
  const { data, error } = await supabase
    .from('workouts')
    .select(
      `
      id,
      started_at,
      status,
      workout_exercises (
        id,
        exercise_id,
        exercises ( name, category ),
        sets ( id, weight_value, weight_unit, reps, logged_at )
      )
    `,
    )
    .eq('user_id', userId)
    .eq('status', 'completed')
    .gte('completed_at', computeLookbackDate(now).toISOString())
    .order('started_at', { ascending: true });

  if (error) throw error;
  return (data ?? []) as unknown as RawWorkoutRow[];
}

async function fetchWorkoutRowsForExercise(
  supabase: SupabaseServerClient,
  userId: string,
  exerciseId: string,
  now: Date,
): Promise<RawWorkoutRow[]> {
  const { data, error } = await supabase
    .from('workouts')
    .select(
      `
      id,
      started_at,
      status,
      workout_exercises!inner (
        id,
        exercise_id,
        exercises ( name, category ),
        sets ( id, weight_value, weight_unit, reps, logged_at )
      )
    `,
    )
    .eq('user_id', userId)
    .eq('status', 'completed')
    .gte('completed_at', computeLookbackDate(now).toISOString())
    .eq('workout_exercises.exercise_id', exerciseId)
    .order('started_at', { ascending: true });

  if (error) throw error;
  return (data ?? []) as unknown as RawWorkoutRow[];
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function getInsightsBundle(
  userId: string,
  opts?: { now?: Date },
): Promise<InsightsBundle & { messages: InsightMessage[]; completedWorkoutCount: number }> {
  const now = opts?.now ?? new Date();
  const supabase = await createSupabaseServerClient();

  const cached = unstable_cache(
    async () => {
      const rows = await fetchWorkoutRows(supabase, userId, now);
      const { workouts, allExerciseSamples, exerciseNameById } = rowsToKernelInput(rows);

      const oneRepMaxSeries = computeOneRepMaxSeries(allExerciseSamples);
      const volumeTrend = computeVolumeTrend(allExerciseSamples, {
        groupBy: 'muscleGroup',
        weeks: INSIGHTS_LOOKBACK_WEEKS,
      });
      const consistency = computeConsistencyScore(workouts, { now });
      const plateaus = detectPlateaus(oneRepMaxSeries);

      const bundle: InsightsBundle = { oneRepMaxSeries, volumeTrend, consistency, plateaus };
      const messages = generateInsightMessages(bundle, {
        exerciseNameById: (id) => exerciseNameById.get(id) ?? '',
      });

      return { ...bundle, messages, completedWorkoutCount: rows.length };
    },
    ['insights', userId],
    { tags: [insightsTag(userId)], revalidate: 3600 },
  );

  return cached();
}

export async function getOneRepMaxSeriesForExercise(
  userId: string,
  exerciseId: string,
  opts?: { now?: Date },
): Promise<OneRepMaxPoint[]> {
  const now = opts?.now ?? new Date();
  const supabase = await createSupabaseServerClient();

  const cached = unstable_cache(
    async () => {
      const rows = await fetchWorkoutRowsForExercise(supabase, userId, exerciseId, now);
      const { allExerciseSamples } = rowsToKernelInput(rows);
      return computeOneRepMaxSeries(allExerciseSamples);
    },
    ['insights', userId, 'exercise', exerciseId],
    { tags: [insightsTag(userId)], revalidate: 3600 },
  );

  return cached();
}
