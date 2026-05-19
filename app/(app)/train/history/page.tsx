import type { Metadata } from 'next';

import { PageContainer } from '@/components/page-container';
import { createSupabaseServerClient } from '@/lib/supabase/server-exports';
import { autoNameWorkout, formatDuration } from '@/features/workout/lib/format';
import { HistoryList } from '@/features/workout/components/HistoryList';
import type { HistoryRowDTO } from '@/features/workout/components/HistoryList';

export const metadata: Metadata = {
  title: 'History — LimenFit',
};

export default async function HistoryPage() {
  const supabase = await createSupabaseServerClient();

  const { data: workouts, error } = await supabase
    .from('workouts')
    .select(
      `id, name, started_at, completed_at, expired_at, status,
       workout_exercises (
         id, exercise_id, position,
         exercises ( name ),
         sets ( id )
       )`,
    )
    .in('status', ['completed', 'expired'])
    .order('started_at', { ascending: false });

  if (error) {
    throw error;
  }

  const rows: HistoryRowDTO[] = (workouts ?? []).map((w) => {
    const wExercises = (w.workout_exercises ?? [])
      .slice()
      .sort((a, b) => ((a.position ?? 0) as number) - ((b.position ?? 0) as number));

    // Dedupe exercise_ids to get unique exercises
    const seenIds = new Set<string>();
    const uniqueExercises: { exercise_id: string; exercises: { name: string } | null }[] = [];
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

    const endIso =
      w.status === 'completed' ? (w.completed_at ?? w.started_at) : (w.expired_at ?? w.started_at);

    const durationLabel = formatDuration(w.started_at, endIso);

    const setCount = wExercises.reduce(
      (sum, we) => sum + ((we.sets as { id: string }[])?.length ?? 0),
      0,
    );

    return {
      id: w.id,
      name: resolvedName || 'Workout',
      startedAt: w.started_at,
      durationLabel,
      exerciseCount: uniqueExercises.length,
      setCount,
      status: w.status as 'completed' | 'expired',
    };
  });

  return (
    <PageContainer title="History">
      <HistoryList rows={rows} />
    </PageContainer>
  );
}
