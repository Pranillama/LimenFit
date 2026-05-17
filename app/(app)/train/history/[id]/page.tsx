import { notFound } from 'next/navigation';

import { PageContainer } from '@/components/page-container';
import { createSupabaseServerClient } from '@/lib/supabase/server-exports';
import { UUID_RE } from '@/lib/utils';
import { buildWorkoutDetailDTO } from '@/features/workout/lib/workoutDetailDTO';
import { WorkoutDetailView } from '@/features/workout/components/WorkoutDetailView';

export default async function HistoryDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  if (!UUID_RE.test(id)) {
    notFound();
  }

  const supabase = await createSupabaseServerClient();

  const { data: row, error: rowError } = await supabase
    .from('workouts')
    .select(
      `id, name, status, started_at, completed_at, expired_at, last_activity_at, plan_workout_id,
       workout_exercises (
         id, exercise_id, position,
         sets ( id, set_number, weight_value, weight_unit, reps )
       )`,
    )
    .eq('id', id)
    .order('position', { referencedTable: 'workout_exercises', ascending: true })
    .order('set_number', { referencedTable: 'workout_exercises.sets', ascending: true })
    .maybeSingle();

  if (rowError) {
    throw rowError;
  }

  if (!row || (row.status !== 'completed' && row.status !== 'expired')) {
    notFound();
  }

  let planName: string | null = null;
  if (row.plan_workout_id) {
    const { data: planRow, error: planError } = await supabase
      .from('plan_workouts')
      .select('name, plans!inner(name)')
      .eq('id', row.plan_workout_id)
      .maybeSingle();

    if (planError) {
      throw planError;
    }

    if (planRow) {
      const plans = planRow.plans as { name: string } | null;
      planName = plans?.name ?? planRow.name;
    }
  }

  const dto = buildWorkoutDetailDTO(
    row as Parameters<typeof buildWorkoutDetailDTO>[0],
    planName ? { planName } : null,
  );

  return (
    <PageContainer>
      <WorkoutDetailView workout={dto} />
    </PageContainer>
  );
}
