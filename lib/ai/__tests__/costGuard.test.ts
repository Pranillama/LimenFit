import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/lib/env', () => ({
  assertServerOnly: () => {},
  env: {
    server: { NODE_ENV: 'test', SUPABASE_SERVICE_ROLE_KEY: 'test' },
    client: {
      NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon',
      NEXT_PUBLIC_SITE_URL: 'https://localhost',
    },
  },
}));

vi.mock('@/lib/supabase/service-role', () => ({
  createSupabaseServiceRoleClient: vi.fn(),
}));

import { DAILY_TOKEN_CAP, checkDailyBudget, recordTokens, todayUtc } from '@/lib/ai/costGuard';
import { createSupabaseServiceRoleClient } from '@/lib/supabase/service-role';

const USER_ID = 'user-cg-1';

function makeSelectChain(data: { tokens_in: number; tokens_out: number } | null) {
  const maybeSingle = vi.fn().mockResolvedValue({ data, error: null });
  const eq2 = vi.fn().mockReturnValue({ maybeSingle });
  const eq1 = vi.fn().mockReturnValue({ eq: eq2 });
  const select = vi.fn().mockReturnValue({ eq: eq1 });
  return { select, eq1, eq2, maybeSingle };
}

describe('costGuard', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-21T12:00:00.000Z'));
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('checkDailyBudget', () => {
    it('selects today-UTC and returns allowed=true under the cap', async () => {
      const chain = makeSelectChain({ tokens_in: 100, tokens_out: 200 });
      const from = vi.fn().mockReturnValue({ select: chain.select });
      vi.mocked(createSupabaseServiceRoleClient).mockReturnValue({ from } as any);

      const result = await checkDailyBudget(USER_ID);

      expect(from).toHaveBeenCalledWith('ai_usage_daily');
      expect(chain.select).toHaveBeenCalledWith('tokens_in, tokens_out');
      expect(chain.eq1).toHaveBeenCalledWith('user_id', USER_ID);
      expect(chain.eq2).toHaveBeenCalledWith('date', todayUtc());
      expect(result.allowed).toBe(true);
      expect(result.usedToday).toBe(300);
    });

    it('treats no-row as zero used today', async () => {
      const chain = makeSelectChain(null);
      const from = vi.fn().mockReturnValue({ select: chain.select });
      vi.mocked(createSupabaseServiceRoleClient).mockReturnValue({ from } as any);

      const result = await checkDailyBudget(USER_ID);
      expect(result.allowed).toBe(true);
      expect(result.usedToday).toBe(0);
    });

    it('flips allowed to false when tokens_in + tokens_out >= DAILY_TOKEN_CAP', async () => {
      const chain = makeSelectChain({
        tokens_in: 30_000,
        tokens_out: 20_000,
      });
      const from = vi.fn().mockReturnValue({ select: chain.select });
      vi.mocked(createSupabaseServiceRoleClient).mockReturnValue({ from } as any);

      const result = await checkDailyBudget(USER_ID);
      expect(result.usedToday).toBe(50_000);
      expect(DAILY_TOKEN_CAP).toBe(50_000);
      expect(result.allowed).toBe(false);
    });

    it('capResetAt is the next-day UTC midnight', async () => {
      const chain = makeSelectChain(null);
      const from = vi.fn().mockReturnValue({ select: chain.select });
      vi.mocked(createSupabaseServiceRoleClient).mockReturnValue({ from } as any);

      const { capResetAt } = await checkDailyBudget(USER_ID);
      expect(capResetAt.toISOString()).toBe('2026-05-22T00:00:00.000Z');
    });
  });

  describe('recordTokens', () => {
    it('upserts tokens via the record_ai_tokens RPC with today-UTC', async () => {
      const rpc = vi.fn().mockResolvedValue({ data: null, error: null });
      vi.mocked(createSupabaseServiceRoleClient).mockReturnValue({ rpc } as any);

      await recordTokens(USER_ID, 120, 80);

      expect(rpc).toHaveBeenCalledWith('record_ai_tokens', {
        p_user_id: USER_ID,
        p_date: '2026-05-21',
        p_tokens_in: 120,
        p_tokens_out: 80,
      });
    });

    it('propagates RPC errors', async () => {
      const rpc = vi.fn().mockResolvedValue({ data: null, error: new Error('rpc failed') });
      vi.mocked(createSupabaseServiceRoleClient).mockReturnValue({ rpc } as any);

      await expect(recordTokens(USER_ID, 1, 1)).rejects.toThrow('rpc failed');
    });
  });
});
