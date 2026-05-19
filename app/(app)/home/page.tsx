import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { PageContainer } from '@/components/page-container';
import { createSupabaseServerClient } from '@/lib/supabase/server-exports';
import {
  buildHomeDashboardDTO,
  buildHomeInsightsDTO,
  LOOKBACK_DAYS,
} from '@/features/home/lib/homeDashboardDTO';
import { getInsightsBundle } from '@/lib/insights/server';
import { HomeDashboardView } from '@/features/home';

export const metadata: Metadata = {
  title: 'Home — LimenFit',
};

export default async function HomePage() {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/');

  const thresholdIso = new Date(Date.now() - LOOKBACK_DAYS * 86_400_000).toISOString();

  const [workoutsResult, insightsBundle] = await Promise.all([
    supabase
      .from('workouts')
      .select(
        `id, name, started_at, completed_at, expired_at, status,
         workout_exercises (
           id, exercise_id, position,
           exercises ( name ),
           sets ( id )
         )`,
      )
      .eq('status', 'completed')
      .gte('started_at', thresholdIso)
      .order('started_at', { ascending: false }),
    getInsightsBundle(user.id),
  ]);

  if (workoutsResult.error !== null) throw workoutsResult.error;

  const now = new Date();
  const dto = buildHomeDashboardDTO(workoutsResult.data ?? []);
  const insightsDTO = buildHomeInsightsDTO(insightsBundle, dto.recentCompletions, now);

  return (
    <PageContainer>
      <HomeDashboardView dto={dto} insightsDTO={insightsDTO} />
    </PageContainer>
  );
}
