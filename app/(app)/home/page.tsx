import type { Metadata } from 'next';

import { PageContainer } from '@/components/page-container';
import { createSupabaseServerClient } from '@/lib/supabase/server-exports';
import { buildHomeDashboardDTO, LOOKBACK_DAYS } from '@/features/home/lib/homeDashboardDTO';
import { HomeDashboardView } from '@/features/home';

export const metadata: Metadata = {
  title: 'Home — LimenFit',
};

export default async function HomePage() {
  const supabase = await createSupabaseServerClient();

  const thresholdIso = new Date(Date.now() - LOOKBACK_DAYS * 86_400_000).toISOString();

  const { data: workouts } = await supabase
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
    .gte('started_at', thresholdIso)
    .order('started_at', { ascending: false });

  const dto = buildHomeDashboardDTO(workouts ?? []);

  return (
    <PageContainer>
      <HomeDashboardView dto={dto} />
    </PageContainer>
  );
}
