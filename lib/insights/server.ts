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
  WorkoutsPerWeekPoint,
} from '@/features/insights/lib/types';
import { getMondayDate, toIsoDateString } from '@/features/insights/lib/weekHelpers';
import { computeOneRepMaxSeries } from '@/features/insights/lib/oneRepMax';
import { computeVolumeTrend } from '@/features/insights/lib/volumeTrend';
import { computeConsistencyScore } from '@/features/insights/lib/consistency';
import { detectPlateaus } from '@/features/insights/lib/plateau';
import { generateInsightMessages } from '@/features/insights/lib/messages';
import { derivePersonalRecords } from '@/features/insights/lib/personalRecords';
import { deriveLastSeenByGroup } from '@/features/insights/lib/lastSeen';

assertServerOnly();

export const INSIGHTS_LOOKBACK_WEEKS = 26;
export const CONSISTENCY_WEEKS = 12;

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
// Pure helpers — exported so unit tests can exercise them without Supabase
// ---------------------------------------------------------------------------

/**
 * Builds a rolling N-week workout-count series from completed WorkoutSamples.
 * De-duplicates at the workout ID level so each session is counted once
 * regardless of how many exercises it contains.
 */
export function computeWorkoutsPerWeekSeries(
  workouts: WorkoutSample[],
  opts: { now: Date; weeks?: number },
): WorkoutsPerWeekPoint[] {
  const weeks = opts.weeks ?? CONSISTENCY_WEEKS;
  const weekWorkoutIds = new Map<string, Set<string>>();

  for (const workout of workouts) {
    const weekStart = toIsoDateString(getMondayDate(new Date(workout.startedAt)));
    if (!weekWorkoutIds.has(weekStart)) weekWorkoutIds.set(weekStart, new Set());
    weekWorkoutIds.get(weekStart)!.add(workout.id);
  }

  const currentMonday = getMondayDate(opts.now);
  const result: WorkoutsPerWeekPoint[] = [];

  for (let i = weeks - 1; i >= 0; i--) {
    const d = new Date(
      currentMonday.getFullYear(),
      currentMonday.getMonth(),
      currentMonday.getDate() - i * 7,
    );
    const weekStart = toIsoDateString(d);
    result.push({ weekStart, count: weekWorkoutIds.get(weekStart)?.size ?? 0 });
  }

  return result;
}

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
      const workoutsPerWeek = computeWorkoutsPerWeekSeries(workouts, { now });
      const personalRecords = derivePersonalRecords(oneRepMaxSeries);
      const lastSeenByGroup = deriveLastSeenByGroup(allExerciseSamples);

      const bundle: InsightsBundle = {
        oneRepMaxSeries,
        volumeTrend,
        consistency,
        plateaus,
        workoutsPerWeek,
        personalRecords,
        lastSeenByGroup,
      };
      const messages = generateInsightMessages(bundle, {
        exerciseNameById: (id) => exerciseNameById.get(id) ?? '',
        now,
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
