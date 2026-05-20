import type { ExerciseCategory } from '@/lib/exercises/catalog';

export type WeightUnit = 'lbs' | 'kg';

/** Canonical muscle-group key — re-uses the existing catalog enum. */
export type MuscleGroup = ExerciseCategory;

// ---------------------------------------------------------------------------
// Input shapes — modeled on the rows returned by workout DB reads
// ---------------------------------------------------------------------------

/** A single logged set within a workout exercise. */
export interface SetSample {
  id: string;
  weight: number;
  reps: number;
  weightUnit: WeightUnit;
}

/**
 * One exercise row within one completed workout.
 * `workoutDate` must be a full ISO-8601 datetime string (e.g. the workout's
 * `started_at`) so local-time week bucketing works correctly.
 */
export interface ExerciseHistorySample {
  exerciseId: string;
  exerciseName: string;
  muscleGroup: MuscleGroup;
  sets: SetSample[];
  workoutId: string;
  workoutDate: string;
}

/** A completed (or expired) workout with all its exercises. */
export interface WorkoutSample {
  id: string;
  startedAt: string;
  status: 'completed' | 'expired';
  exercises: ExerciseHistorySample[];
}

// ---------------------------------------------------------------------------
// Output shapes
// ---------------------------------------------------------------------------

/** Best estimated one-rep max for one exercise in one workout session. */
export interface OneRepMaxPoint {
  workoutId: string;
  workoutDate: string;
  exerciseId: string;
  exerciseName: string;
  e1rm: number;
  weightUnit: WeightUnit;
  /** Heaviest single set (by weight) used in this session, for top-set plateau detection. */
  topSetWeight: number;
  topSetReps: number;
}

/** Total training volume for one group key in one ISO week. */
export interface VolumeTrendPoint {
  weekStart: string;
  groupKey: string;
  totalVolume: number;
  /** null for the first week in the output window (no prior period to compare). */
  deltaVolume: number | null;
  direction: 'up' | 'down' | 'flat';
}

export interface ConsistencyScore {
  avgWorkoutsPerWeek: number;
  streakWeeks: number;
  weeksAnalyzed: number;
}

export interface PlateauSignal {
  exerciseId: string;
  exerciseName: string;
  sessionsAnalyzed: number;
  /** Signed percentage: positive = improving, negative = declining. */
  e1rmChangePct: number;
  /** True when the top-set weight improved from first to last session in the window. */
  topSetImproving: boolean;
  isPlateauing: boolean;
}

/** Completed-workout count for one ISO week (Monday-anchored). */
export interface WorkoutsPerWeekPoint {
  weekStart: string;
  count: number;
}

export interface InsightsBundle {
  oneRepMaxSeries: OneRepMaxPoint[];
  volumeTrend: VolumeTrendPoint[];
  consistency: ConsistencyScore;
  plateaus: PlateauSignal[];
  workoutsPerWeek: WorkoutsPerWeekPoint[];
}

export interface InsightMessage {
  id: string;
  severity: 'info' | 'positive' | 'warning';
  text: string;
}
