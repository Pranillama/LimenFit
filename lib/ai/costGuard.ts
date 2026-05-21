import { assertServerOnly } from '@/lib/env';
import { createSupabaseServiceRoleClient } from '@/lib/supabase/service-role';

assertServerOnly();

export const DAILY_TOKEN_CAP = 50_000;

export function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

function nextUtcMidnight(): Date {
  const now = new Date();
  return new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() + 1,
      0,
      0,
      0,
      0,
    ),
  );
}

export async function checkDailyBudget(
  userId: string,
): Promise<{ allowed: boolean; usedToday: number; capResetAt: Date }> {
  const supabase = createSupabaseServiceRoleClient();
  const date = todayUtc();
  const capResetAt = nextUtcMidnight();

  const { data, error } = await supabase
    .from('ai_usage_daily')
    .select('tokens_in, tokens_out')
    .eq('user_id', userId)
    .eq('date', date)
    .maybeSingle();

  if (error) throw error;

  const usedToday = (data?.tokens_in ?? 0) + (data?.tokens_out ?? 0);
  return { allowed: usedToday < DAILY_TOKEN_CAP, usedToday, capResetAt };
}

export async function recordTokens(
  userId: string,
  tokensIn: number,
  tokensOut: number,
): Promise<void> {
  const supabase = createSupabaseServiceRoleClient();
  const date = todayUtc();

  const { error } = await supabase.rpc('record_ai_tokens', {
    p_user_id: userId,
    p_date: date,
    p_tokens_in: tokensIn,
    p_tokens_out: tokensOut,
  });

  if (error) throw error;
}
