import type {
  InsightMessage,
  InsightsBundle,
  VolumeTrendPoint,
} from '@/features/insights/lib/types';
import { autoNameWorkout } from '@/features/workout/lib/format';

export const LOOKBACK_DAYS = 14;

export interface HomeWorkoutSummary {
  id: string;
  name: string;
  startedAt: string;
  endedAt: string | null;
  durationMs: number;
  exerciseCount: number;
  setCount: number;
  status: 'completed';
}

export interface HomeDashboardDTO {
  recentCompletions: HomeWorkoutSummary[];
}

type RawSet = { id: string };
type RawExercise = { name: string } | null;
type RawWorkoutExercise = {
  id: string;
  exercise_id: string;
  position: number | null;
  exercises: RawExercise;
  sets: RawSet[];
};
type RawWorkout = {
  id: string;
  name: string | null;
  started_at: string;
  completed_at: string | null;
  expired_at: string | null;
  status: string;
  workout_exercises: RawWorkoutExercise[];
};

// ---------------------------------------------------------------------------
// HomeInsightsDTO — narrowed from InsightsBundle for the home dashboard
// ---------------------------------------------------------------------------

export interface HomeConsistency {
  workoutsPerWeek: number;
  streakWeeks: number;
  message: string;
}

export interface HomeVolumeDelta {
  muscleGroup: string;
  direction: 'up' | 'down' | 'flat';
  deltaVolume: number | null;
}

export interface HomeInsightsDTO {
  workoutsThisWeek: number;
  consistency: HomeConsistency;
  topMessages: InsightMessage[];
  volumeDeltas: HomeVolumeDelta[];
  hasEnoughData: boolean;
}

const SEVERITY_ORDER: Record<InsightMessage['severity'], number> = {
  warning: 0,
  positive: 1,
  info: 2,
};

function buildConsistencyMessage(avgPerWeek: number, streakWeeks: number): string {
  if (avgPerWeek === 0) return 'Start logging to build a streak';
  if (streakWeeks >= 4) return `${streakWeeks}-week streak — outstanding`;
  if (streakWeeks >= 2) return `${streakWeeks} weeks in a row — keep it up`;
  const perWeekStr = Number.isInteger(avgPerWeek) ? String(avgPerWeek) : avgPerWeek.toFixed(1);
  return `On track — ${perWeekStr}×/wk avg`;
}

export function buildHomeInsightsDTO(
  bundle: InsightsBundle & { messages: InsightMessage[]; completedWorkoutCount: number },
  recentCompletions: HomeWorkoutSummary[],
  now: Date,
): HomeInsightsDTO {
  // Monday-based week boundaries (local time)
  const d = new Date(now);
  const dayOfWeek = d.getDay();
  const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  d.setDate(d.getDate() - daysFromMonday);
  d.setHours(0, 0, 0, 0);
  const weekStartMs = d.getTime();
  const weekEndMs = weekStartMs + 7 * 86_400_000;

  const workoutsThisWeek = recentCompletions.filter((r) => {
    const t = new Date(r.startedAt).getTime();
    return t >= weekStartMs && t < weekEndMs;
  }).length;

  const { avgWorkoutsPerWeek, streakWeeks } = bundle.consistency;
  const consistency: HomeConsistency = {
    workoutsPerWeek: avgWorkoutsPerWeek,
    streakWeeks,
    message: buildConsistencyMessage(avgWorkoutsPerWeek, streakWeeks),
  };

  const hasEnoughData = bundle.completedWorkoutCount >= 3;

  const topMessages = [...bundle.messages]
    .sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity])
    .slice(0, 3);

  const latestByGroup = new Map<string, VolumeTrendPoint>();
  for (const point of bundle.volumeTrend) {
    const existing = latestByGroup.get(point.groupKey);
    if (!existing || point.weekStart > existing.weekStart) {
      latestByGroup.set(point.groupKey, point);
    }
  }
  const volumeDeltas: HomeVolumeDelta[] = Array.from(latestByGroup.values()).map((point) => ({
    muscleGroup: point.groupKey,
    direction: point.direction,
    deltaVolume: point.deltaVolume,
  }));

  return { workoutsThisWeek, consistency, topMessages, volumeDeltas, hasEnoughData };
}

// ---------------------------------------------------------------------------
// HomeDashboardDTO
// ---------------------------------------------------------------------------

export function buildHomeDashboardDTO(rows: RawWorkout[]): HomeDashboardDTO {
  const recentCompletions: HomeWorkoutSummary[] = rows
    .filter((w) => w.status === 'completed')
    .map((w): HomeWorkoutSummary => {
      const wExercises = (w.workout_exercises ?? [])
        .slice()
        .sort((a, b) => ((a.position ?? 0) as number) - ((b.position ?? 0) as number));

      const seenIds = new Set<string>();
      const uniqueExercises: RawWorkoutExercise[] = [];
      for (const we of wExercises) {
        if (!seenIds.has(we.exercise_id)) {
          seenIds.add(we.exercise_id);
          uniqueExercises.push(we);
        }
      }

      const exerciseNames = uniqueExercises
        .map((ue) => (ue.exercises as { name: string } | null)?.name ?? '')
        .filter(Boolean);

      const resolvedName = w.name && w.name.trim() ? w.name.trim() : autoNameWorkout(exerciseNames);

      const endedAt = w.completed_at ?? w.started_at;

      const durationMs = Math.max(
        0,
        new Date(endedAt).getTime() - new Date(w.started_at).getTime(),
      );

      const setCount = wExercises.reduce(
        (sum, we) => sum + ((we.sets as RawSet[])?.length ?? 0),
        0,
      );

      return {
        id: w.id,
        name: resolvedName || 'Workout',
        startedAt: w.started_at,
        endedAt,
        durationMs,
        exerciseCount: uniqueExercises.length,
        setCount,
        status: 'completed',
      };
    })
    .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());

  return { recentCompletions };
}
