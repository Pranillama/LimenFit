import type { Metadata } from 'next';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { PageContainer } from '@/components/page-container';
import { createSupabaseServerClient } from '@/lib/supabase/server-exports';
import { PlanList } from '@/features/plan/components/PlanList';
import type { PlanRowDTO } from '@/features/plan/components/PlanList';
import { PendingDuplicateFinalizer } from '@/features/plan/components/PendingDuplicateFinalizer';

export const metadata: Metadata = {
  title: 'My Plans — LimenFit',
};

export default async function PlansPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: plans } = await supabase
    .from('plans')
    .select(
      `id, name, updated_at,
       plan_workouts (
         id, name, position,
         plan_exercises (id)
       )`,
    )
    .eq('user_id', user!.id)
    .order('updated_at', { ascending: false });

  const rows: PlanRowDTO[] = (plans ?? []).map((p) => {
    const workouts = (p.plan_workouts ?? []) as { id: string; plan_exercises: { id: string }[] }[];
    const exerciseCount = workouts.reduce(
      (sum, w) => sum + ((w.plan_exercises ?? []).length),
      0,
    );
    return {
      id: p.id,
      name: p.name,
      workoutCount: workouts.length,
      exerciseCount,
    };
  });

  return (
    <PageContainer>
      <PendingDuplicateFinalizer />
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">My Plans</h1>
        <Button asChild size="sm">
          <Link href="/train/plans/new">Create Plan</Link>
        </Button>
      </div>
      <PlanList rows={rows} />
    </PageContainer>
  );
}
