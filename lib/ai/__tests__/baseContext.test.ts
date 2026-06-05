import { describe, it, expect, vi, beforeEach } from 'vitest';

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

vi.mock('@/lib/insights/server', () => ({
  getInsightsBundle: vi.fn(),
}));

vi.mock('@/lib/settings/server', () => ({
  getOrCreateUserSettings: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: vi.fn(),
}));

import { buildBaseContext } from '@/lib/ai/baseContext';
import { getInsightsBundle } from '@/lib/insights/server';
import { getOrCreateUserSettings } from '@/lib/settings/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { InsightMessage, InsightsBundle } from '@/features/insights/lib/types';

type MockedInsightsBundle = InsightsBundle & {
  messages: InsightMessage[];
  completedWorkoutCount: number;
};

const USER_ID = 'user-abc';
const NOW = new Date('2026-01-19T12:00:00.000Z'); // Monday — week start

function makeBundle(overrides: Partial<MockedInsightsBundle> = {}): MockedInsightsBundle {
  return {
    oneRepMaxSeries: [],
    volumeTrend: [],
    consistency: { avgWorkoutsPerWeek: 0, streakWeeks: 3, weeksAnalyzed: 8 },
    plateaus: [],
    workoutsPerWeek: [{ weekStart: '2026-01-19', count: 2 }],
    personalRecords: [],
    lastSeenByGroup: {},
    messages: [],
    completedWorkoutCount: 0,
    ...overrides,
  };
}

describe('buildBaseContext', () => {
  let supabaseStub: { from: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    vi.clearAllMocks();
    supabaseStub = { from: vi.fn() };
    vi.mocked(createSupabaseServerClient).mockResolvedValue(supabaseStub as any);
    vi.mocked(getOrCreateUserSettings).mockResolvedValue({
      weightUnit: 'lbs',
      heightUnit: 'ft',
      restTimerDefaultSeconds: 90,
    });
  });

  it('returns user.unitPref from settings and currentWeek.workoutCount from the bundle', async () => {
    vi.mocked(getInsightsBundle).mockResolvedValue(makeBundle());

    const ctx = await buildBaseContext(USER_ID, { now: NOW });

    expect(ctx.user.unitPref).toBe('lbs');
    expect(ctx.user.weeklyGoal).toBe(3);
    expect(ctx.currentWeek.workoutCount).toBe(2);
  });

  it('caps plateaus, recentPRs, and gaps to the top-N (3 each)', async () => {
    const oneRepMaxSeries = Array.from({ length: 5 }, (_, i) => ({
      workoutId: `wk-${i}`,
      workoutDate: '2026-01-19T09:00:00.000Z',
      exerciseId: `ex-${i}`,
      exerciseName: `Ex ${i}`,
      muscleGroup: 'chest' as const,
      e1rm: 100 + i,
      weightUnit: 'lbs' as const,
      topSetWeight: 100 + i,
      topSetReps: 5,
    }));
    const plateaus = Array.from({ length: 5 }, (_, i) => ({
      exerciseId: `ex-${i}`,
      exerciseName: `Ex ${i}`,
      sessionsAnalyzed: 4,
      e1rmChangePct: -0.5,
      topSetImproving: false,
      isPlateauing: true,
    }));
    const personalRecords = Array.from({ length: 5 }, (_, i) => ({
      exerciseId: `pr-${i}`,
      exerciseName: `PR ${i}`,
      workoutDate: `2026-01-1${5 + (i % 5)}T09:00:00.000Z`,
      topSetWeight: 200,
      topSetReps: 3,
      e1rm: 220 + i,
      weightUnit: 'lbs' as const,
      priorBestE1rm: 210,
    }));
    const lastSeenByGroup: Record<string, string> = {
      chest: '2025-12-01T00:00:00.000Z', // ~49 days
      back: '2025-12-05T00:00:00.000Z',
      legs: '2025-12-10T00:00:00.000Z',
      shoulders: '2025-12-15T00:00:00.000Z',
      arms: '2025-12-20T00:00:00.000Z',
    };

    vi.mocked(getInsightsBundle).mockResolvedValue(
      makeBundle({ oneRepMaxSeries, plateaus, personalRecords, lastSeenByGroup }),
    );

    const ctx = await buildBaseContext(USER_ID, { now: NOW });

    expect(ctx.insights.activePlateaus).toHaveLength(3);
    expect(ctx.insights.recentPRs).toHaveLength(3);
    expect(ctx.insights.gaps).toHaveLength(3);
  });

  it('does not perform any DB reads beyond getInsightsBundle and the settings read', async () => {
    vi.mocked(getInsightsBundle).mockResolvedValue(makeBundle());

    await buildBaseContext(USER_ID, { now: NOW });

    // The Supabase client returned by createSupabaseServerClient is only used by
    // getOrCreateUserSettings (which is mocked). buildBaseContext itself must
    // not call .from() — otherwise we'd be doing an extra read here.
    expect(supabaseStub.from).not.toHaveBeenCalled();
    expect(getInsightsBundle).toHaveBeenCalledTimes(1);
    expect(getOrCreateUserSettings).toHaveBeenCalledTimes(1);
  });
});
