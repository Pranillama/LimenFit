import { assertServerOnly } from '@/lib/env';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getInsightsBundle } from '@/lib/insights/server';
import { getOrCreateUserSettings } from '@/lib/settings/server';
import type { MuscleGroup, OneRepMaxPoint, WeightUnit } from '@/features/insights/lib/types';
import { getMondayDate, toIsoDateString } from '@/features/insights/lib/weekHelpers';

assertServerOnly();

const DAY_MS = 86_400_000;
const RECENT_PR_WINDOW_DAYS = 7;
const TOP_N = 3;
const DEFAULT_WEEKLY_GOAL = 3;

export interface BaseContextActivePlateau {
  exercise: string;
  sessions: number;
  weight: number;
  reps: number;
}

export interface BaseContextRecentPR {
  exercise: string;
  e1rm: number;
  date: string;
}

export interface BaseContextGap {
  group: MuscleGroup;
  daysSince: number;
}

export interface BaseContext {
  user: {
    unitPref: WeightUnit;
    weeklyGoal: number;
  };
  currentWeek: {
    workoutCount: number;
    sessionsByGroup: Partial<Record<MuscleGroup, number>>;
  };
  insights: {
    streakWeeks: number;
    activePlateaus: BaseContextActivePlateau[];
    recentPRs: BaseContextRecentPR[];
    gaps: BaseContextGap[];
  };
}

export async function buildBaseContext(
  userId: string,
  opts?: { now?: Date },
): Promise<BaseContext> {
  const now = opts?.now ?? new Date();
  const supabase = await createSupabaseServerClient();

  const [bundle, settings] = await Promise.all([
    getInsightsBundle(userId, { now }),
    getOrCreateUserSettings(supabase, userId),
  ]);

  // --- currentWeek -------------------------------------------------------
  const monday = getMondayDate(now);
  const weekStartMs = monday.getTime();
  const weekEndMs = weekStartMs + 7 * DAY_MS;
  const currentWeekStart = toIsoDateString(monday);

  // workoutCount mirrors home-dashboard counting (every completed workout,
  // including ones with no 1RM-eligible sets).
  const currentWeekPoint = bundle.workoutsPerWeek.find((w) => w.weekStart === currentWeekStart);
  const workoutCount = currentWeekPoint?.count ?? 0;

  // sessionsByGroup is ORM-backed: it only reflects workouts with sets that
  // produce a valid 1RM point. Bodyweight-only or otherwise-non-1RM workouts
  // contribute to workoutCount above but not to per-group session counts.
  const sessionsByGroup: Partial<Record<MuscleGroup, Set<string>>> = {};
  for (const point of bundle.oneRepMaxSeries) {
    const ts = new Date(point.workoutDate).getTime();
    if (ts < weekStartMs || ts >= weekEndMs) continue;
    const group = point.muscleGroup;
    if (!sessionsByGroup[group]) sessionsByGroup[group] = new Set();
    sessionsByGroup[group]!.add(point.workoutId);
  }
  const sessionsByGroupCounts: Partial<Record<MuscleGroup, number>> = {};
  for (const [group, ids] of Object.entries(sessionsByGroup) as [MuscleGroup, Set<string>][]) {
    sessionsByGroupCounts[group] = ids.size;
  }

  // --- insights.activePlateaus ------------------------------------------
  const latestOrmByExercise = new Map<string, OneRepMaxPoint>();
  for (const point of bundle.oneRepMaxSeries) {
    const existing = latestOrmByExercise.get(point.exerciseId);
    if (!existing || point.workoutDate > existing.workoutDate) {
      latestOrmByExercise.set(point.exerciseId, point);
    }
  }
  const activePlateaus: BaseContextActivePlateau[] = [];
  for (const p of bundle.plateaus) {
    if (!p.isPlateauing) continue;
    const latest = latestOrmByExercise.get(p.exerciseId);
    if (!latest) continue;
    activePlateaus.push({
      exercise: p.exerciseName,
      sessions: p.sessionsAnalyzed,
      weight: latest.topSetWeight,
      reps: latest.topSetReps,
    });
    if (activePlateaus.length >= TOP_N) break;
  }

  // --- insights.recentPRs (last 7 days, top N most recent) --------------
  const nowMs = now.getTime();
  const recentPRs: BaseContextRecentPR[] = [...bundle.personalRecords]
    .filter((pr) => nowMs - new Date(pr.workoutDate).getTime() <= RECENT_PR_WINDOW_DAYS * DAY_MS)
    .sort((a, b) => b.workoutDate.localeCompare(a.workoutDate))
    .slice(0, TOP_N)
    .map((pr) => ({
      exercise: pr.exerciseName,
      e1rm: Math.round(pr.e1rm),
      date: pr.workoutDate.slice(0, 10),
    }));

  // --- insights.gaps (groups not trained in 10+ days, top N) -------------
  const gaps: BaseContextGap[] = Object.entries(bundle.lastSeenByGroup)
    .map(([group, lastSeen]) => ({
      group: group as MuscleGroup,
      daysSince: Math.floor((nowMs - new Date(lastSeen).getTime()) / DAY_MS),
    }))
    .filter((g) => g.daysSince >= 10)
    .sort((a, b) => b.daysSince - a.daysSince)
    .slice(0, TOP_N);

  return {
    user: {
      unitPref: settings.weightUnit,
      weeklyGoal: DEFAULT_WEEKLY_GOAL,
    },
    currentWeek: {
      workoutCount,
      sessionsByGroup: sessionsByGroupCounts,
    },
    insights: {
      streakWeeks: bundle.consistency.streakWeeks,
      activePlateaus,
      recentPRs,
      gaps,
    },
  };
}
