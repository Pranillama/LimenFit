import { SubscriptionView } from '@/features/profile';
import { checkDailyBudget, DAILY_TOKEN_CAP } from '@/lib/ai/costGuard';
import { createSupabaseServerClient } from '@/lib/supabase/server-exports';

export default async function SubscriptionPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const now = new Date();
  const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();

  const [budget, plansResult, workoutsResult] = await Promise.all([
    checkDailyBudget(user.id),
    supabase.from('plans').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
    supabase
      .from('workouts')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('started_at', startOfMonth),
  ]);

  return (
    <SubscriptionView
      aiUsedToday={budget.usedToday}
      aiCap={DAILY_TOKEN_CAP}
      workoutsThisMonth={workoutsResult.count ?? 0}
      savedPlans={plansResult.count ?? 0}
    />
  );
}
