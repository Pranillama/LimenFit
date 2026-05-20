import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { InsightsPanel } from '@/features/insights/components/InsightsPanel';
import { TrainPageShell } from '@/features/workout/components/TrainPageShell';
import { getInsightsBundle } from '@/lib/insights/server';
import { createSupabaseServerClient } from '@/lib/supabase/server-exports';

export const metadata: Metadata = {
  title: 'Train — LimenFit',
};

export default async function TrainPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/');

  const bundle = await getInsightsBundle(user.id);

  return (
    <TrainPageShell
      insightsPanel={
        <InsightsPanel bundle={bundle} completedWorkoutCount={bundle.completedWorkoutCount} />
      }
    />
  );
}
