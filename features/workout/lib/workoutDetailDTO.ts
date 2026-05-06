import type { WorkoutDetailDTO } from '../components/WorkoutDetailView';

type RawExercise = {
  id: string;
  exercise_id: string;
  position: number | null;
  sets: Array<{
    id: string;
    set_number: number;
    weight_value: number | null;
    weight_unit: string | null;
    reps: number | null;
  }> | null;
};

type HistoryStatus = 'completed' | 'expired';

type RawWorkout = {
  id: string;
  name: string | null;
  status: HistoryStatus;
  started_at: string;
  completed_at: string | null;
  expired_at: string | null;
  last_activity_at: string;
  plan_workout_id: string | null;
  workout_exercises: RawExercise[] | null;
};

type PlanInfo = { planName: string } | null;

export function buildWorkoutDetailDTO(row: RawWorkout, plan: PlanInfo): WorkoutDetailDTO {
  const exercises = ((row.workout_exercises ?? []) as RawExercise[])
    .slice()
    .sort((a, b) => ((a.position ?? 0) as number) - ((b.position ?? 0) as number))
    .map((we) => ({
      id: we.id,
      exercise_id: we.exercise_id,
      position: we.position ?? 0,
      sets: ((we.sets ?? []) as NonNullable<RawExercise['sets']>)
        .slice()
        .sort((a, b) => a.set_number - b.set_number)
        .map((s) => ({
          localId: s.id,
          set_number: s.set_number,
          weight_value: s.weight_value,
          weight_unit: s.weight_unit,
          reps: s.reps,
        })),
    }));

  return {
    id: row.id,
    name: row.name ?? null,
    status: row.status,
    started_at: row.started_at,
    completed_at: row.completed_at ?? null,
    expired_at: row.expired_at ?? null,
    last_activity_at: row.last_activity_at,
    plan_workout_id: row.plan_workout_id ?? null,
    planName: plan?.planName ?? null,
    exercises,
  };
}
