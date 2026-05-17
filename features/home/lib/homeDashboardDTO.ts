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
  status: 'completed' | 'expired';
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

export function buildHomeDashboardDTO(rows: RawWorkout[]): HomeDashboardDTO {
  const recentCompletions: HomeWorkoutSummary[] = rows
    .filter((w) => w.status === 'completed' || w.status === 'expired')
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

      const endedAt =
        w.status === 'completed'
          ? (w.completed_at ?? w.started_at)
          : (w.expired_at ?? w.started_at);

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
        status: w.status as 'completed' | 'expired',
      };
    })
    .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());

  return { recentCompletions };
}
