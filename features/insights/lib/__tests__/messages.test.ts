import { describe, expect, it } from 'vitest';
import { generateInsightMessages } from '../messages';
import type { InsightsBundle, OneRepMaxPoint, PersonalRecord, VolumeTrendPoint } from '../types';

const NOW = new Date('2026-01-15T12:00:00Z');

const EMPTY_BUNDLE: InsightsBundle = {
  oneRepMaxSeries: [],
  volumeTrend: [],
  consistency: { avgWorkoutsPerWeek: 0, streakWeeks: 0, weeksAnalyzed: 4 },
  plateaus: [],
  workoutsPerWeek: [],
  personalRecords: [],
  lastSeenByGroup: {},
};

const noName = () => '';
const nameById = (id: string) => {
  const map: Record<string, string> = {
    bench: 'Bench Press',
    squat: 'Squat',
  };
  return map[id] ?? '';
};

function makePR(overrides: Partial<PersonalRecord> = {}): PersonalRecord {
  return {
    exerciseId: 'bench',
    exerciseName: 'Bench Press',
    workoutDate: '2026-01-13T10:00:00Z',
    topSetWeight: 225,
    topSetReps: 5,
    e1rm: 262.5,
    weightUnit: 'lbs',
    priorBestE1rm: 250,
    ...overrides,
  };
}

function makeOrm(overrides: Partial<OneRepMaxPoint> = {}): OneRepMaxPoint {
  return {
    workoutId: 'w1',
    workoutDate: '2026-01-13T10:00:00Z',
    exerciseId: 'bench',
    exerciseName: 'Bench Press',
    muscleGroup: 'chest',
    e1rm: 250,
    weightUnit: 'lbs',
    topSetWeight: 215,
    topSetReps: 5,
    ...overrides,
  };
}

function makeVolume(overrides: Partial<VolumeTrendPoint> = {}): VolumeTrendPoint {
  return {
    weekStart: '2026-01-12',
    groupKey: 'chest',
    totalVolume: 6000,
    deltaVolume: 1000,
    direction: 'up',
    ...overrides,
  };
}

describe('generateInsightMessages', () => {
  describe('cold start', () => {
    it('returns empty array for an empty bundle', () => {
      expect(generateInsightMessages(EMPTY_BUNDLE, { exerciseNameById: noName, now: NOW })).toEqual(
        [],
      );
    });
  });

  describe('Rule A — PR chips', () => {
    it('fires for PRs within 7 days, sorted desc, capped at 2', () => {
      const bundle: InsightsBundle = {
        ...EMPTY_BUNDLE,
        personalRecords: [
          makePR({ exerciseId: 'bench', workoutDate: '2026-01-10T10:00:00Z' }),
          makePR({
            exerciseId: 'squat',
            exerciseName: 'Squat',
            workoutDate: '2026-01-14T10:00:00Z',
          }),
          makePR({
            exerciseId: 'dead',
            exerciseName: 'Deadlift',
            workoutDate: '2026-01-13T10:00:00Z',
          }),
        ],
      };
      const msgs = generateInsightMessages(bundle, { exerciseNameById: nameById, now: NOW });
      const prMsgs = msgs.filter((m) => m.category === 'pr');
      expect(prMsgs).toHaveLength(2);
      expect(prMsgs[0]!.text).toContain('Squat');
      expect(prMsgs[1]!.text).toContain('Deadlift');
      expect(prMsgs[0]!.href).toBe('/train/exercises/squat');
    });

    it('does not fire for PRs older than 7 days', () => {
      const bundle: InsightsBundle = {
        ...EMPTY_BUNDLE,
        personalRecords: [makePR({ exerciseId: 'bench', workoutDate: '2026-01-01T10:00:00Z' })],
      };
      const msgs = generateInsightMessages(bundle, { exerciseNameById: nameById, now: NOW });
      expect(msgs.filter((m) => m.category === 'pr')).toHaveLength(0);
    });
  });

  describe('Rule B — Plateau chips', () => {
    it('fires for plateauing exercise with prescription text', () => {
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
        oneRepMaxSeries: [makeOrm({ topSetWeight: 215, topSetReps: 5 })],
      };
      const msgs = generateInsightMessages(bundle, { exerciseNameById: nameById, now: NOW });
      const plateau = msgs.find((m) => m.category === 'plateau');
      expect(plateau).toBeDefined();
      expect(plateau!.text).toContain('Plateau · Bench Press');
      expect(plateau!.text).toContain('215×5');
      expect(plateau!.text).toContain('drop sets');
      expect(plateau!.href).toBe('/train/exercises/bench');
    });

    it('does not fire when isPlateauing is false', () => {
      const bundle: InsightsBundle = {
        ...EMPTY_BUNDLE,
        plateaus: [
          {
            exerciseId: 'bench',
            exerciseName: 'Bench Press',
            sessionsAnalyzed: 4,
            e1rmChangePct: 5,
            topSetImproving: true,
            isPlateauing: false,
          },
        ],
        oneRepMaxSeries: [makeOrm()],
      };
      const msgs = generateInsightMessages(bundle, { exerciseNameById: nameById, now: NOW });
      expect(msgs.filter((m) => m.category === 'plateau')).toHaveLength(0);
    });

    it('plateau on a non-emitted PR exercise is still eligible when PR chips are capped', () => {
      // Three recent PRs exist but PR chips cap at 2, so the third PR is dropped.
      // A plateau on that third exercise must NOT be suppressed by Rule B.
      const bundle: InsightsBundle = {
        ...EMPTY_BUNDLE,
        personalRecords: [
          makePR({ exerciseId: 'bench', workoutDate: '2026-01-14T10:00:00Z' }),
          makePR({
            exerciseId: 'squat',
            exerciseName: 'Squat',
            workoutDate: '2026-01-13T10:00:00Z',
          }),
          makePR({
            exerciseId: 'dead',
            exerciseName: 'Deadlift',
            workoutDate: '2026-01-12T10:00:00Z',
          }),
        ],
        plateaus: [
          {
            exerciseId: 'dead',
            exerciseName: 'Deadlift',
            sessionsAnalyzed: 4,
            e1rmChangePct: 0.5,
            topSetImproving: false,
            isPlateauing: true,
          },
        ],
        oneRepMaxSeries: [makeOrm({ exerciseId: 'dead', exerciseName: 'Deadlift' })],
      };
      const msgs = generateInsightMessages(bundle, { exerciseNameById: nameById, now: NOW });
      expect(msgs.filter((m) => m.category === 'pr').map((m) => m.text)).toEqual(
        expect.arrayContaining([expect.stringContaining('Bench')]),
      );
      // PRs are capped at 2, so the Deadlift PR is not emitted.
      expect(msgs.filter((m) => m.category === 'pr')).toHaveLength(2);
      expect(msgs.some((m) => m.category === 'pr' && m.text.includes('Deadlift'))).toBe(false);
      // The Deadlift plateau must therefore remain eligible.
      const plateau = msgs.find((m) => m.category === 'plateau');
      expect(plateau).toBeDefined();
      expect(plateau!.text).toContain('Deadlift');
    });

    it('PR + plateau on same exercise: PR wins, plateau suppressed', () => {
      const bundle: InsightsBundle = {
        ...EMPTY_BUNDLE,
        personalRecords: [makePR({ exerciseId: 'bench', workoutDate: '2026-01-13T10:00:00Z' })],
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
        oneRepMaxSeries: [makeOrm()],
      };
      const msgs = generateInsightMessages(bundle, { exerciseNameById: nameById, now: NOW });
      expect(msgs.filter((m) => m.category === 'pr')).toHaveLength(1);
      expect(msgs.filter((m) => m.category === 'plateau')).toHaveLength(0);
    });
  });

  describe('Rule C — Gap chips', () => {
    it('fires when a group is ≥10 days stale, sorted by daysSince desc', () => {
      const bundle: InsightsBundle = {
        ...EMPTY_BUNDLE,
        oneRepMaxSeries: [
          makeOrm({ muscleGroup: 'chest', workoutDate: '2026-01-01T10:00:00Z' }),
          makeOrm({ muscleGroup: 'legs', workoutDate: '2026-01-03T10:00:00Z' }),
          makeOrm({ muscleGroup: 'back', workoutDate: '2026-01-13T10:00:00Z' }),
        ],
        lastSeenByGroup: {
          chest: '2026-01-01T10:00:00Z', // ~14 days
          legs: '2026-01-03T10:00:00Z', // ~12 days
          back: '2026-01-13T10:00:00Z', // 2 days — does not fire
        },
      };
      const msgs = generateInsightMessages(bundle, { exerciseNameById: noName, now: NOW });
      const gaps = msgs.filter((m) => m.category === 'gap');
      expect(gaps).toHaveLength(1);
      expect(gaps[0]!.text).toContain('Chest');
      expect(gaps[0]!.text).toMatch(/14 days/);
      expect(gaps[0]!.href).toBe('/train');
    });

    it('does not fire when no group is ≥10 days stale', () => {
      const bundle: InsightsBundle = {
        ...EMPTY_BUNDLE,
        oneRepMaxSeries: [makeOrm({ muscleGroup: 'chest' })],
        lastSeenByGroup: { chest: '2026-01-13T10:00:00Z' },
      };
      const msgs = generateInsightMessages(bundle, { exerciseNameById: noName, now: NOW });
      expect(msgs.filter((m) => m.category === 'gap')).toHaveLength(0);
    });

    it('does not fire for a stale group absent from one-rep-max-backed data', () => {
      // `lastSeenByGroup` carries the group (e.g. bodyweight-only work) but it
      // never produced an OneRepMaxPoint → Rule C must reject it.
      const bundle: InsightsBundle = {
        ...EMPTY_BUNDLE,
        oneRepMaxSeries: [],
        lastSeenByGroup: { chest: '2026-01-01T10:00:00Z' },
      };
      const msgs = generateInsightMessages(bundle, { exerciseNameById: noName, now: NOW });
      expect(msgs.filter((m) => m.category === 'gap')).toHaveLength(0);
    });

    it('fires for a stale group with matching one-rep-max-backed data', () => {
      const bundle: InsightsBundle = {
        ...EMPTY_BUNDLE,
        oneRepMaxSeries: [
          makeOrm({ muscleGroup: 'chest', workoutDate: '2026-01-01T10:00:00Z' }),
        ],
        lastSeenByGroup: { chest: '2026-01-01T10:00:00Z' },
      };
      const msgs = generateInsightMessages(bundle, { exerciseNameById: noName, now: NOW });
      const gaps = msgs.filter((m) => m.category === 'gap');
      expect(gaps).toHaveLength(1);
      expect(gaps[0]!.text).toContain('Chest');
    });
  });

  describe('Rule D — Volume chips', () => {
    it('fires "up" with numbers when delta ≥ 500 and prev > 0', () => {
      const bundle: InsightsBundle = {
        ...EMPTY_BUNDLE,
        volumeTrend: [
          makeVolume({ groupKey: 'chest', totalVolume: 6000, deltaVolume: 1000, direction: 'up' }),
        ],
      };
      const msgs = generateInsightMessages(bundle, { exerciseNameById: noName, now: NOW });
      const vol = msgs.find((m) => m.category === 'volume');
      expect(vol).toBeDefined();
      expect(vol!.severity).toBe('positive');
      expect(vol!.text).toContain('+20%');
      expect(vol!.text).toContain('5,000');
      expect(vol!.text).toContain('6,000');
    });

    it('fires "down" with planned-question text', () => {
      const bundle: InsightsBundle = {
        ...EMPTY_BUNDLE,
        volumeTrend: [
          makeVolume({
            groupKey: 'chest',
            totalVolume: 4000,
            deltaVolume: -1000,
            direction: 'down',
          }),
        ],
      };
      const msgs = generateInsightMessages(bundle, { exerciseNameById: noName, now: NOW });
      const vol = msgs.find((m) => m.category === 'volume');
      expect(vol!.severity).toBe('info');
      expect(vol!.text).toContain('−20%');
      expect(vol!.text).toContain('was this planned?');
    });

    it('does not fire when |delta| < 500', () => {
      const bundle: InsightsBundle = {
        ...EMPTY_BUNDLE,
        volumeTrend: [makeVolume({ totalVolume: 5400, deltaVolume: 400, direction: 'up' })],
      };
      const msgs = generateInsightMessages(bundle, { exerciseNameById: noName, now: NOW });
      expect(msgs.filter((m) => m.category === 'volume')).toHaveLength(0);
    });

    it('does not fire when direction is flat', () => {
      const bundle: InsightsBundle = {
        ...EMPTY_BUNDLE,
        volumeTrend: [makeVolume({ totalVolume: 5050, deltaVolume: 50, direction: 'flat' })],
      };
      const msgs = generateInsightMessages(bundle, { exerciseNameById: noName, now: NOW });
      expect(msgs.filter((m) => m.category === 'volume')).toHaveLength(0);
    });

    it('does not fire when prev week volume is 0', () => {
      const bundle: InsightsBundle = {
        ...EMPTY_BUNDLE,
        volumeTrend: [makeVolume({ totalVolume: 5000, deltaVolume: 5000, direction: 'up' })],
      };
      const msgs = generateInsightMessages(bundle, { exerciseNameById: noName, now: NOW });
      expect(msgs.filter((m) => m.category === 'volume')).toHaveLength(0);
    });
  });

  describe('ranking & cap', () => {
    it('enforces priority order PR → plateau → gap → volume and caps at 4', () => {
      const bundle: InsightsBundle = {
        ...EMPTY_BUNDLE,
        personalRecords: [
          makePR({ exerciseId: 'bench', workoutDate: '2026-01-14T10:00:00Z' }),
          makePR({
            exerciseId: 'squat',
            exerciseName: 'Squat',
            workoutDate: '2026-01-13T10:00:00Z',
          }),
          makePR({
            exerciseId: 'dead',
            exerciseName: 'Deadlift',
            workoutDate: '2026-01-12T10:00:00Z',
          }),
        ],
        plateaus: [
          {
            exerciseId: 'ohp',
            exerciseName: 'Overhead Press',
            sessionsAnalyzed: 4,
            e1rmChangePct: 0.5,
            topSetImproving: false,
            isPlateauing: true,
          },
        ],
        oneRepMaxSeries: [
          makeOrm({ exerciseId: 'ohp', exerciseName: 'Overhead Press' }),
          makeOrm({
            exerciseId: 'leg-press',
            exerciseName: 'Leg Press',
            workoutId: 'w-legs',
            muscleGroup: 'legs',
            workoutDate: '2026-01-01T10:00:00Z',
          }),
        ],
        lastSeenByGroup: { legs: '2026-01-01T10:00:00Z' },
        volumeTrend: [
          makeVolume({ groupKey: 'chest', totalVolume: 6000, deltaVolume: 1000, direction: 'up' }),
          makeVolume({ groupKey: 'back', totalVolume: 7000, deltaVolume: 2000, direction: 'up' }),
        ],
      };
      const msgs = generateInsightMessages(bundle, { exerciseNameById: nameById, now: NOW });
      expect(msgs).toHaveLength(4);
      expect(msgs.map((m) => m.category)).toEqual(['pr', 'pr', 'plateau', 'gap']);
    });

    it('always caps at 4', () => {
      const bundle: InsightsBundle = {
        ...EMPTY_BUNDLE,
        personalRecords: [
          makePR({ exerciseId: 'a', exerciseName: 'A', workoutDate: '2026-01-14T10:00:00Z' }),
          makePR({ exerciseId: 'b', exerciseName: 'B', workoutDate: '2026-01-13T10:00:00Z' }),
        ],
        volumeTrend: [
          makeVolume({ groupKey: 'chest', totalVolume: 6000, deltaVolume: 1000, direction: 'up' }),
          makeVolume({ groupKey: 'back', totalVolume: 7000, deltaVolume: 2000, direction: 'up' }),
          makeVolume({ groupKey: 'legs', totalVolume: 8000, deltaVolume: 3000, direction: 'up' }),
        ],
      };
      const msgs = generateInsightMessages(bundle, { exerciseNameById: nameById, now: NOW });
      expect(msgs.length).toBeLessThanOrEqual(4);
    });
  });

  describe('schema', () => {
    it('every message has id, text, severity, and category', () => {
      const bundle: InsightsBundle = {
        ...EMPTY_BUNDLE,
        personalRecords: [makePR()],
      };
      const msgs = generateInsightMessages(bundle, { exerciseNameById: nameById, now: NOW });
      for (const m of msgs) {
        expect(m.id.length).toBeGreaterThan(0);
        expect(m.text.length).toBeGreaterThan(0);
        expect(['info', 'positive', 'warning']).toContain(m.severity);
        expect(['pr', 'plateau', 'gap', 'volume', 'consistency']).toContain(m.category);
      }
    });
  });
});
