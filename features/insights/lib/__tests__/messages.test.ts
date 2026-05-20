import { describe, expect, it } from 'vitest';
import { generateInsightMessages } from '../messages';
import type { InsightsBundle } from '../types';

const EMPTY_BUNDLE: InsightsBundle = {
  oneRepMaxSeries: [],
  volumeTrend: [],
  consistency: { avgWorkoutsPerWeek: 0, streakWeeks: 0, weeksAnalyzed: 4 },
  plateaus: [],
  workoutsPerWeek: [],
};

const noName = () => '';
const nameById = (id: string) => {
  const map: Record<string, string> = {
    bench: 'Bench Press',
    squat: 'Squat',
  };
  return map[id] ?? '';
};

describe('generateInsightMessages', () => {
  it('returns empty array for an empty bundle', () => {
    expect(generateInsightMessages(EMPTY_BUNDLE, { exerciseNameById: noName })).toEqual([]);
  });

  describe('plateau messages', () => {
    it('emits a warning for each plateauing exercise', () => {
      const bundle: InsightsBundle = {
        ...EMPTY_BUNDLE,
        plateaus: [
          {
            exerciseId: 'bench',
            exerciseName: 'Bench Press',
            sessionsAnalyzed: 4,
            e1rmChangePct: 0.8,
            topSetImproving: false,
            isPlateauing: true,
          },
        ],
      };
      const msgs = generateInsightMessages(bundle, { exerciseNameById: nameById });
      expect(msgs).toHaveLength(1);
      expect(msgs[0]!.severity).toBe('warning');
      expect(msgs[0]!.id).toBe('plateau-bench');
      expect(msgs[0]!.text).toContain('Bench Press');
      expect(msgs[0]!.text).toContain('4 sessions');
    });

    it('does not emit a message for non-plateauing exercises', () => {
      const bundle: InsightsBundle = {
        ...EMPTY_BUNDLE,
        plateaus: [
          {
            exerciseId: 'squat',
            exerciseName: 'Squat',
            sessionsAnalyzed: 4,
            e1rmChangePct: 5,
            topSetImproving: true,
            isPlateauing: false,
          },
        ],
      };
      const msgs = generateInsightMessages(bundle, { exerciseNameById: nameById });
      expect(msgs).toHaveLength(0);
    });
  });

  describe('consistency messages', () => {
    it('emits a strong-streak positive for streakWeeks ≥ 4', () => {
      const bundle: InsightsBundle = {
        ...EMPTY_BUNDLE,
        consistency: { avgWorkoutsPerWeek: 3.5, streakWeeks: 5, weeksAnalyzed: 4 },
      };
      const msgs = generateInsightMessages(bundle, { exerciseNameById: noName });
      const streak = msgs.find((m) => m.id === 'consistency-streak-strong');
      expect(streak).toBeDefined();
      expect(streak?.severity).toBe('positive');
      expect(streak?.text).toContain('5 weeks');
    });

    it('emits a streak positive for streakWeeks 2–3', () => {
      const bundle: InsightsBundle = {
        ...EMPTY_BUNDLE,
        consistency: { avgWorkoutsPerWeek: 3, streakWeeks: 2, weeksAnalyzed: 4 },
      };
      const msgs = generateInsightMessages(bundle, { exerciseNameById: noName });
      const streak = msgs.find((m) => m.id === 'consistency-streak');
      expect(streak?.severity).toBe('positive');
      expect(streak?.text).toContain('2 weeks');
    });

    it('emits a warning when avgWorkoutsPerWeek < 1', () => {
      const bundle: InsightsBundle = {
        ...EMPTY_BUNDLE,
        consistency: { avgWorkoutsPerWeek: 0.5, streakWeeks: 0, weeksAnalyzed: 4 },
      };
      const msgs = generateInsightMessages(bundle, { exerciseNameById: noName });
      const low = msgs.find((m) => m.id === 'consistency-low');
      expect(low?.severity).toBe('warning');
    });

    it('emits info when avgWorkoutsPerWeek is between 1 and 2', () => {
      const bundle: InsightsBundle = {
        ...EMPTY_BUNDLE,
        consistency: { avgWorkoutsPerWeek: 1.5, streakWeeks: 0, weeksAnalyzed: 4 },
      };
      const msgs = generateInsightMessages(bundle, { exerciseNameById: noName });
      const info = msgs.find((m) => m.id === 'consistency-moderate-low');
      expect(info?.severity).toBe('info');
    });

    it('emits nothing for consistency when streak=1 and avg ≥ 2', () => {
      const bundle: InsightsBundle = {
        ...EMPTY_BUNDLE,
        consistency: { avgWorkoutsPerWeek: 2.5, streakWeeks: 1, weeksAnalyzed: 4 },
      };
      const consistencyMsgs = generateInsightMessages(bundle, { exerciseNameById: noName }).filter(
        (m) => m.id.startsWith('consistency'),
      );
      expect(consistencyMsgs).toHaveLength(0);
    });
  });

  describe('volume trend messages', () => {
    it('emits a positive for an up-trending group', () => {
      const bundle: InsightsBundle = {
        ...EMPTY_BUNDLE,
        volumeTrend: [
          {
            weekStart: '2024-01-15',
            groupKey: 'bench',
            totalVolume: 5000,
            deltaVolume: 500,
            direction: 'up',
          },
        ],
      };
      const msgs = generateInsightMessages(bundle, { exerciseNameById: nameById });
      const vol = msgs.find((m) => m.id === 'volume-up-bench');
      expect(vol?.severity).toBe('positive');
      expect(vol?.text).toContain('Bench Press');
    });

    it('emits an info for a down-trending group', () => {
      const bundle: InsightsBundle = {
        ...EMPTY_BUNDLE,
        volumeTrend: [
          {
            weekStart: '2024-01-15',
            groupKey: 'bench',
            totalVolume: 4000,
            deltaVolume: -600,
            direction: 'down',
          },
        ],
      };
      const msgs = generateInsightMessages(bundle, { exerciseNameById: nameById });
      const vol = msgs.find((m) => m.id === 'volume-down-bench');
      expect(vol?.severity).toBe('info');
    });

    it('uses only the most recent week per groupKey', () => {
      const bundle: InsightsBundle = {
        ...EMPTY_BUNDLE,
        volumeTrend: [
          {
            weekStart: '2024-01-08',
            groupKey: 'bench',
            totalVolume: 3000,
            deltaVolume: null,
            direction: 'flat',
          },
          {
            weekStart: '2024-01-15',
            groupKey: 'bench',
            totalVolume: 5000,
            deltaVolume: 2000,
            direction: 'up',
          },
        ],
      };
      const msgs = generateInsightMessages(bundle, { exerciseNameById: nameById });
      // Only the most recent (Jan 15, direction=up) should generate a message
      expect(msgs.filter((m) => m.id.startsWith('volume'))).toHaveLength(1);
      expect(msgs.find((m) => m.id === 'volume-up-bench')).toBeDefined();
    });

    it('formats unknown groupKey as capitalized label (muscle group fallback)', () => {
      const bundle: InsightsBundle = {
        ...EMPTY_BUNDLE,
        volumeTrend: [
          {
            weekStart: '2024-01-15',
            groupKey: 'full_body',
            totalVolume: 5000,
            deltaVolume: 500,
            direction: 'up',
          },
        ],
      };
      const msgs = generateInsightMessages(bundle, { exerciseNameById: () => '' });
      const vol = msgs.find((m) => m.id === 'volume-up-full_body');
      expect(vol?.text).toContain('Full Body');
    });

    it('does not emit a volume message when direction is flat', () => {
      const bundle: InsightsBundle = {
        ...EMPTY_BUNDLE,
        volumeTrend: [
          {
            weekStart: '2024-01-15',
            groupKey: 'bench',
            totalVolume: 4500,
            deltaVolume: 50,
            direction: 'flat',
          },
        ],
      };
      const msgs = generateInsightMessages(bundle, { exerciseNameById: nameById });
      expect(msgs.filter((m) => m.id.startsWith('volume'))).toHaveLength(0);
    });
  });

  describe('message text quality', () => {
    it('messages contain no raw numeric coefficients from formulas', () => {
      const bundle: InsightsBundle = {
        ...EMPTY_BUNDLE,
        plateaus: [
          {
            exerciseId: 'bench',
            exerciseName: 'Bench Press',
            sessionsAnalyzed: 4,
            e1rmChangePct: 0.8,
            topSetImproving: false,
            isPlateauing: true,
          },
        ],
        consistency: { avgWorkoutsPerWeek: 4, streakWeeks: 4, weeksAnalyzed: 4 },
        volumeTrend: [
          {
            weekStart: '2024-01-15',
            groupKey: 'bench',
            totalVolume: 5000,
            deltaVolume: 500,
            direction: 'up',
          },
        ],
      };
      const msgs = generateInsightMessages(bundle, { exerciseNameById: nameById });
      for (const msg of msgs) {
        // No lone decimals like "0.8" or coefficients like "1 +"
        expect(msg.text).not.toMatch(/\b1 \+/);
        expect(msg.text).not.toMatch(/\b0\.\d+\b/);
      }
    });

    it('all messages have non-empty id and text', () => {
      const bundle: InsightsBundle = {
        ...EMPTY_BUNDLE,
        plateaus: [
          {
            exerciseId: 'bench',
            exerciseName: 'Bench Press',
            sessionsAnalyzed: 4,
            e1rmChangePct: 0.5,
            topSetImproving: false,
            isPlateauing: true,
          },
        ],
        consistency: { avgWorkoutsPerWeek: 4.5, streakWeeks: 5, weeksAnalyzed: 4 },
        volumeTrend: [
          {
            weekStart: '2024-01-15',
            groupKey: 'squat',
            totalVolume: 6000,
            deltaVolume: 1000,
            direction: 'up',
          },
        ],
      };
      const msgs = generateInsightMessages(bundle, { exerciseNameById: nameById });
      for (const msg of msgs) {
        expect(msg.id.length).toBeGreaterThan(0);
        expect(msg.text.length).toBeGreaterThan(0);
        expect(['info', 'positive', 'warning']).toContain(msg.severity);
      }
    });
  });

  describe('message snapshots', () => {
    it('plateau bundle — full text and order', () => {
      const bundle: InsightsBundle = {
        ...EMPTY_BUNDLE,
        plateaus: [
          {
            exerciseId: 'bench',
            exerciseName: 'Bench Press',
            sessionsAnalyzed: 4,
            e1rmChangePct: 0.8,
            topSetImproving: false,
            isPlateauing: true,
          },
        ],
      };
      expect(generateInsightMessages(bundle, { exerciseNameById: nameById })).toEqual([
        {
          id: 'plateau-bench',
          severity: 'warning',
          text: 'Bench Press has been flat for 4 sessions — try varying rep range or adding a deload week.',
        },
      ]);
    });

    it('consistency bundle — strong streak full text and order', () => {
      const bundle: InsightsBundle = {
        ...EMPTY_BUNDLE,
        consistency: { avgWorkoutsPerWeek: 4, streakWeeks: 5, weeksAnalyzed: 4 },
      };
      expect(generateInsightMessages(bundle, { exerciseNameById: noName })).toEqual([
        {
          id: 'consistency-streak-strong',
          severity: 'positive',
          text: "You've hit your training target 5 weeks in a row — outstanding consistency.",
        },
      ]);
    });

    it('volume bundle — up direction full text and order', () => {
      const bundle: InsightsBundle = {
        ...EMPTY_BUNDLE,
        volumeTrend: [
          {
            weekStart: '2024-01-15',
            groupKey: 'bench',
            totalVolume: 5000,
            deltaVolume: 500,
            direction: 'up',
          },
        ],
      };
      expect(generateInsightMessages(bundle, { exerciseNameById: nameById })).toEqual([
        {
          id: 'volume-up-bench',
          severity: 'positive',
          text: 'Volume for Bench Press is trending up this week — great momentum.',
        },
      ]);
    });

    it('combined plateau + consistency + volume — full text and order', () => {
      const bundle: InsightsBundle = {
        ...EMPTY_BUNDLE,
        plateaus: [
          {
            exerciseId: 'bench',
            exerciseName: 'Bench Press',
            sessionsAnalyzed: 4,
            e1rmChangePct: 0.5,
            topSetImproving: false,
            isPlateauing: true,
          },
        ],
        consistency: { avgWorkoutsPerWeek: 4.5, streakWeeks: 5, weeksAnalyzed: 4 },
        volumeTrend: [
          {
            weekStart: '2024-01-15',
            groupKey: 'squat',
            totalVolume: 6000,
            deltaVolume: 1000,
            direction: 'up',
          },
        ],
      };
      expect(generateInsightMessages(bundle, { exerciseNameById: nameById })).toEqual([
        {
          id: 'plateau-bench',
          severity: 'warning',
          text: 'Bench Press has been flat for 4 sessions — try varying rep range or adding a deload week.',
        },
        {
          id: 'consistency-streak-strong',
          severity: 'positive',
          text: "You've hit your training target 5 weeks in a row — outstanding consistency.",
        },
        {
          id: 'volume-up-squat',
          severity: 'positive',
          text: 'Volume for Squat is trending up this week — great momentum.',
        },
      ]);
    });
  });
});
