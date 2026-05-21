import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { FunctionDeclaration } from '@google/genai';

import { assertServerOnly } from '@/lib/env';
import type { Database } from '@/lib/supabase/types';
import {
  getInsightsBundle,
  rowsToKernelInput,
} from '@/lib/insights/server';
import { estimateOneRepMax } from '@/features/insights/lib/oneRepMax';
import type { PersonalRecord, WeightUnit } from '@/features/insights/lib/types';

assertServerOnly();

export type ToolName =
  | 'get_exercise_history'
  | 'search_sets_by_criteria'
  | 'get_personal_records'
  | 'get_recent_workouts';

export interface ToolContext {
  supabase: SupabaseClient<Database>;
  userId: string;
  now?: Date;
}

export class ToolNotFoundError extends Error {
  constructor(name: string) {
    super(`Unknown tool: ${name}`);
    this.name = 'ToolNotFoundError';
  }
}

export class ToolValidationError extends Error {
  readonly issues: z.ZodIssue[];
  constructor(name: string, issues: z.ZodIssue[]) {
    super(`Invalid arguments for tool "${name}"`);
    this.name = 'ToolValidationError';
    this.issues = issues;
  }
}

// ---------------------------------------------------------------------------
// Argument schemas
// ---------------------------------------------------------------------------

const getExerciseHistorySchema = z.object({
  exerciseId: z.string().uuid(),
  days: z.number().int().min(1).max(365).default(90),
});

const searchSetsByCriteriaSchema = z
  .object({
    exerciseId: z.string().uuid().optional(),
    weightGte: z.number().nonnegative().optional(),
    weightLte: z.number().nonnegative().optional(),
    repsGte: z.number().int().nonnegative().optional(),
    repsLte: z.number().int().nonnegative().optional(),
    dateFrom: z.string().optional(),
    dateTo: z.string().optional(),
    limit: z.number().int().min(1).max(50).default(10),
  })
  .refine(
    (v) =>
      v.exerciseId !== undefined ||
      v.weightGte !== undefined ||
      v.weightLte !== undefined ||
      v.repsGte !== undefined ||
      v.repsLte !== undefined ||
      v.dateFrom !== undefined ||
      v.dateTo !== undefined,
    { message: 'At least one filter must be provided' },
  );

const getPersonalRecordsSchema = z.object({
  exerciseId: z.string().uuid().optional(),
});

const getRecentWorkoutsSchema = z.object({
  days: z.number().int().min(1).max(60).default(14),
});

export type GetExerciseHistoryArgs = z.infer<typeof getExerciseHistorySchema>;
export type SearchSetsByCriteriaArgs = z.infer<typeof searchSetsByCriteriaSchema>;
export type GetPersonalRecordsArgs = z.infer<typeof getPersonalRecordsSchema>;
export type GetRecentWorkoutsArgs = z.infer<typeof getRecentWorkoutsSchema>;

// ---------------------------------------------------------------------------
// Result shapes (exported for the route + tests)
// ---------------------------------------------------------------------------

export interface ExerciseHistorySessionPayload {
  workoutDate: string;
  sets: Array<{ weight: number; reps: number; unit: WeightUnit }>;
  e1rm: number;
  topSetWeight: number;
  topSetReps: number;
}

export interface ExerciseHistoryPayload {
  exerciseId: string;
  exerciseName: string;
  sessions: ExerciseHistorySessionPayload[];
}

export interface SearchSetMatch {
  setId: string;
  exerciseName: string;
  weight: number;
  reps: number;
  unit: WeightUnit;
  workoutDate: string;
}

export interface RecentWorkoutPayload {
  id: string;
  name: string;
  startedAt: string;
  completedAt: string | null;
  durationMs: number;
  exerciseCount: number;
  setCount: number;
  exerciseNames: string[];
}

// ---------------------------------------------------------------------------
// Function declarations (Gemini JSON Schema format)
// ---------------------------------------------------------------------------

const TOOL_DECLARATIONS: Record<ToolName, FunctionDeclaration> = {
  get_exercise_history: {
    name: 'get_exercise_history',
    description:
      'Fetch recent completed sets for one exercise. Use for next-session suggestions and "show me my recent X" questions. Returns sessions in chronological order with per-set weight/reps/unit plus the session e1RM and top set.',
    parameters: {
      type: 'OBJECT',
      properties: {
        exerciseId: { type: 'STRING', description: 'UUID of the exercise.' },
        days: {
          type: 'INTEGER',
          description: 'Lookback window in days. Default 90, max 365.',
        },
      },
      required: ['exerciseId'],
    } as FunctionDeclaration['parameters'],
  },
  search_sets_by_criteria: {
    name: 'search_sets_by_criteria',
    description:
      'Find logged sets matching filters (exercise, weight range, rep range, date range). Use for "when did I last hit 225?" style lookups. Returns matches in descending date order.',
    parameters: {
      type: 'OBJECT',
      properties: {
        exerciseId: { type: 'STRING', description: 'Optional exercise UUID to scope the search.' },
        weightGte: { type: 'NUMBER', description: 'Minimum weight (inclusive).' },
        weightLte: { type: 'NUMBER', description: 'Maximum weight (inclusive).' },
        repsGte: { type: 'INTEGER', description: 'Minimum reps (inclusive).' },
        repsLte: { type: 'INTEGER', description: 'Maximum reps (inclusive).' },
        dateFrom: { type: 'STRING', description: 'ISO date — only sets on/after this date.' },
        dateTo: { type: 'STRING', description: 'ISO date — only sets on/before this date.' },
        limit: { type: 'INTEGER', description: 'Max results. Default 10, max 50.' },
      },
    } as FunctionDeclaration['parameters'],
  },
  get_personal_records: {
    name: 'get_personal_records',
    description:
      'Return current personal records (e1RM and top-set highs). Omit exerciseId for all PRs, or pass one to scope to a single lift. Use for records/bests/breakthroughs questions.',
    parameters: {
      type: 'OBJECT',
      properties: {
        exerciseId: { type: 'STRING', description: 'Optional exercise UUID to scope the PRs.' },
      },
    } as FunctionDeclaration['parameters'],
  },
  get_recent_workouts: {
    name: 'get_recent_workouts',
    description:
      'Return completed workouts in the last N days with exercise names, set counts, and duration. Use for "what did I do this week?" style summaries.',
    parameters: {
      type: 'OBJECT',
      properties: {
        days: {
          type: 'INTEGER',
          description: 'Lookback window in days. Default 14, max 60.',
        },
      },
    } as FunctionDeclaration['parameters'],
  },
};

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

async function handleGetExerciseHistory(
  args: GetExerciseHistoryArgs,
  ctx: ToolContext,
): Promise<ExerciseHistoryPayload> {
  const now = ctx.now ?? new Date();
  const since = new Date(now.getTime() - args.days * 86_400_000).toISOString();

  const { data, error } = await ctx.supabase
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
    .eq('user_id', ctx.userId)
    .eq('status', 'completed')
    .gte('started_at', since)
    .eq('workout_exercises.exercise_id', args.exerciseId)
    .order('started_at', { ascending: true });

  if (error) throw error;

  const rows = (data ?? []) as unknown as Parameters<typeof rowsToKernelInput>[0];
  const { allExerciseSamples, exerciseNameById } = rowsToKernelInput(rows);

  // Group samples by workoutId (one session per workout)
  const sessionsByWorkout = new Map<string, ExerciseHistorySessionPayload>();
  for (const sample of allExerciseSamples) {
    if (sample.exerciseId !== args.exerciseId) continue;
    if (sample.sets.length === 0) continue;

    let topSet = sample.sets[0]!;
    let bestE1rm = 0;
    const payloadSets = sample.sets.map((s) => {
      const e = estimateOneRepMax(s.weight, s.reps);
      if (e > bestE1rm) bestE1rm = e;
      if (s.weight > topSet.weight) topSet = s;
      return { weight: s.weight, reps: s.reps, unit: s.weightUnit };
    });

    sessionsByWorkout.set(sample.workoutId, {
      workoutDate: sample.workoutDate,
      sets: payloadSets,
      e1rm: Math.round(bestE1rm * 10) / 10,
      topSetWeight: topSet.weight,
      topSetReps: topSet.reps,
    });
  }

  const sessions = Array.from(sessionsByWorkout.values()).sort((a, b) =>
    a.workoutDate.localeCompare(b.workoutDate),
  );

  return {
    exerciseId: args.exerciseId,
    exerciseName: exerciseNameById.get(args.exerciseId) ?? '',
    sessions,
  };
}

async function handleSearchSetsByCriteria(
  args: SearchSetsByCriteriaArgs,
  ctx: ToolContext,
): Promise<SearchSetMatch[]> {
  let query = ctx.supabase
    .from('sets')
    .select(
      `
      id,
      weight_value,
      weight_unit,
      reps,
      logged_at,
      workout_exercises!inner (
        exercise_id,
        exercises!inner ( id, name ),
        workouts!inner ( id, started_at, user_id, status )
      )
      `,
    )
    .eq('workout_exercises.workouts.user_id', ctx.userId)
    .eq('workout_exercises.workouts.status', 'completed');

  if (args.exerciseId) query = query.eq('workout_exercises.exercise_id', args.exerciseId);
  if (args.weightGte !== undefined) query = query.gte('weight_value', args.weightGte);
  if (args.weightLte !== undefined) query = query.lte('weight_value', args.weightLte);
  if (args.repsGte !== undefined) query = query.gte('reps', args.repsGte);
  if (args.repsLte !== undefined) query = query.lte('reps', args.repsLte);
  if (args.dateFrom)
    query = query.gte('workout_exercises.workouts.started_at', args.dateFrom);
  if (args.dateTo) query = query.lte('workout_exercises.workouts.started_at', args.dateTo);

  const { data, error } = await query
    .order('logged_at', { ascending: false })
    .limit(args.limit);

  if (error) throw error;

  type Row = {
    id: string;
    weight_value: number;
    weight_unit: string;
    reps: number;
    logged_at: string;
    workout_exercises: {
      exercises: { id: string; name: string } | null;
      workouts: { id: string; started_at: string } | null;
    } | null;
  };

  return ((data ?? []) as unknown as Row[]).map((row) => ({
    setId: row.id,
    exerciseName: row.workout_exercises?.exercises?.name ?? '',
    weight: row.weight_value,
    reps: row.reps,
    unit: row.weight_unit as WeightUnit,
    workoutDate: row.workout_exercises?.workouts?.started_at ?? row.logged_at,
  }));
}

async function handleGetPersonalRecords(
  args: GetPersonalRecordsArgs,
  ctx: ToolContext,
): Promise<PersonalRecord[]> {
  const bundle = await getInsightsBundle(ctx.userId, { now: ctx.now });
  const records = bundle.personalRecords;
  if (!args.exerciseId) return records;
  return records.filter((pr) => pr.exerciseId === args.exerciseId);
}

async function handleGetRecentWorkouts(
  args: GetRecentWorkoutsArgs,
  ctx: ToolContext,
): Promise<RecentWorkoutPayload[]> {
  const now = ctx.now ?? new Date();
  const since = new Date(now.getTime() - args.days * 86_400_000).toISOString();

  const { data, error } = await ctx.supabase
    .from('workouts')
    .select(
      `id, name, started_at, completed_at, status,
       workout_exercises (
         id, exercise_id, position,
         exercises ( name ),
         sets ( id )
       )`,
    )
    .eq('user_id', ctx.userId)
    .eq('status', 'completed')
    .gte('started_at', since)
    .order('started_at', { ascending: false });

  if (error) throw error;

  type RawWE = {
    id: string;
    exercise_id: string;
    position: number | null;
    exercises: { name: string } | null;
    sets: Array<{ id: string }>;
  };
  type RawW = {
    id: string;
    name: string | null;
    started_at: string;
    completed_at: string | null;
    workout_exercises: RawWE[];
  };

  return ((data ?? []) as unknown as RawW[]).map((w): RecentWorkoutPayload => {
    const wes = (w.workout_exercises ?? [])
      .slice()
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));

    const seen = new Set<string>();
    const uniqueWes: RawWE[] = [];
    for (const we of wes) {
      if (!seen.has(we.exercise_id)) {
        seen.add(we.exercise_id);
        uniqueWes.push(we);
      }
    }

    const exerciseNames = uniqueWes
      .map((we) => we.exercises?.name ?? '')
      .filter((n): n is string => n.length > 0);

    const setCount = wes.reduce((sum, we) => sum + (we.sets?.length ?? 0), 0);

    const endedIso = w.completed_at ?? w.started_at;
    const durationMs = Math.max(
      0,
      new Date(endedIso).getTime() - new Date(w.started_at).getTime(),
    );

    return {
      id: w.id,
      name: w.name?.trim() || exerciseNames[0] || 'Workout',
      startedAt: w.started_at,
      completedAt: w.completed_at,
      durationMs,
      exerciseCount: uniqueWes.length,
      setCount,
      exerciseNames,
    };
  });
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

interface ToolEntry {
  schema: z.ZodType;
  declaration: FunctionDeclaration;
  handler: (args: never, ctx: ToolContext) => Promise<unknown>;
}

export const READONLY_TOOLS: Record<ToolName, ToolEntry> = {
  get_exercise_history: {
    schema: getExerciseHistorySchema,
    declaration: TOOL_DECLARATIONS.get_exercise_history,
    handler: handleGetExerciseHistory as ToolEntry['handler'],
  },
  search_sets_by_criteria: {
    schema: searchSetsByCriteriaSchema,
    declaration: TOOL_DECLARATIONS.search_sets_by_criteria,
    handler: handleSearchSetsByCriteria as ToolEntry['handler'],
  },
  get_personal_records: {
    schema: getPersonalRecordsSchema,
    declaration: TOOL_DECLARATIONS.get_personal_records,
    handler: handleGetPersonalRecords as ToolEntry['handler'],
  },
  get_recent_workouts: {
    schema: getRecentWorkoutsSchema,
    declaration: TOOL_DECLARATIONS.get_recent_workouts,
    handler: handleGetRecentWorkouts as ToolEntry['handler'],
  },
};

export const READONLY_TOOL_DECLARATIONS: FunctionDeclaration[] = Object.values(
  READONLY_TOOLS,
).map((t) => t.declaration);

export async function dispatchToolCall(
  name: string,
  rawArgs: unknown,
  ctx: ToolContext,
): Promise<unknown> {
  if (!(name in READONLY_TOOLS)) {
    throw new ToolNotFoundError(name);
  }
  const entry = READONLY_TOOLS[name as ToolName];
  const parsed = entry.schema.safeParse(rawArgs ?? {});
  if (!parsed.success) {
    throw new ToolValidationError(name, parsed.error.issues);
  }
  return entry.handler(parsed.data as never, ctx);
}
