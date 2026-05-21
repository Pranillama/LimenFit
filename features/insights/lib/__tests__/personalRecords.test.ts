import { describe, expect, it } from 'vitest';
import { derivePersonalRecords } from '../personalRecords';
import type { OneRepMaxPoint } from '../types';

function pt(overrides: Partial<OneRepMaxPoint>): OneRepMaxPoint {
  return {
    workoutId: 'w1',
    workoutDate: '2026-01-01T10:00:00Z',
    exerciseId: 'bench',
    exerciseName: 'Bench Press',
    muscleGroup: 'chest',
    e1rm: 100,
    weightUnit: 'lbs',
    topSetWeight: 100,
    topSetReps: 5,
    ...overrides,
  };
}

describe('derivePersonalRecords', () => {
  it('first-ever session is a PR with priorBestE1rm = null', () => {
    const records = derivePersonalRecords([
      pt({
        workoutId: 'w1',
        workoutDate: '2026-01-01T10:00:00Z',
        e1rm: 116.7,
        topSetWeight: 100,
        topSetReps: 5,
      }),
    ]);
    expect(records).toHaveLength(1);
    expect(records[0]!.priorBestE1rm).toBeNull();
    expect(records[0]!.e1rm).toBeCloseTo(116.7);
  });

  it('fires a PR when e1rm exceeds prior best', () => {
    const records = derivePersonalRecords([
      pt({
        workoutId: 'w1',
        workoutDate: '2026-01-01T10:00:00Z',
        e1rm: 116.7,
        topSetWeight: 100,
        topSetReps: 5,
      }),
      pt({
        workoutId: 'w2',
        workoutDate: '2026-01-08T10:00:00Z',
        e1rm: 121.0,
        topSetWeight: 110,
        topSetReps: 3,
      }),
    ]);
    expect(records).toHaveLength(2);
    expect(records[1]!.priorBestE1rm).toBeCloseTo(116.7);
    expect(records[1]!.workoutDate).toBe('2026-01-08T10:00:00Z');
  });

  it('does not fire when weight × reps ties and e1rm is not improved', () => {
    const records = derivePersonalRecords([
      pt({
        workoutId: 'w1',
        workoutDate: '2026-01-01T10:00:00Z',
        e1rm: 116.7,
        topSetWeight: 100,
        topSetReps: 5,
      }),
      pt({
        workoutId: 'w2',
        workoutDate: '2026-01-08T10:00:00Z',
        e1rm: 116.7,
        topSetWeight: 100,
        topSetReps: 5,
      }),
    ]);
    expect(records).toHaveLength(1);
    expect(records[0]!.workoutDate).toBe('2026-01-01T10:00:00Z');
  });

  it('fires an absolute-weight PR when reps not lower', () => {
    const records = derivePersonalRecords([
      pt({
        workoutId: 'w1',
        workoutDate: '2026-01-01T10:00:00Z',
        e1rm: 100,
        topSetWeight: 100,
        topSetReps: 3,
      }),
      pt({
        workoutId: 'w2',
        workoutDate: '2026-01-08T10:00:00Z',
        e1rm: 100,
        topSetWeight: 105,
        topSetReps: 3,
      }),
    ]);
    // PR via beats absolute (weight up, reps same) — e1rm tie does not cause regress
    expect(records.find((r) => r.workoutDate === '2026-01-08T10:00:00Z')).toBeDefined();
  });

  it('groups by exerciseId and computes PRs independently', () => {
    const records = derivePersonalRecords([
      pt({ exerciseId: 'bench', workoutId: 'w1', workoutDate: '2026-01-01T00:00:00Z', e1rm: 100 }),
      pt({
        exerciseId: 'squat',
        exerciseName: 'Squat',
        workoutId: 'w1',
        workoutDate: '2026-01-01T00:00:00Z',
        e1rm: 200,
      }),
      pt({ exerciseId: 'bench', workoutId: 'w2', workoutDate: '2026-01-08T00:00:00Z', e1rm: 110 }),
    ]);
    expect(records.filter((r) => r.exerciseId === 'bench')).toHaveLength(2);
    expect(records.filter((r) => r.exerciseId === 'squat')).toHaveLength(1);
  });

  it('preserves the weight unit from the source OneRepMaxPoint (kg)', () => {
    const records = derivePersonalRecords([
      pt({ workoutId: 'w1', weightUnit: 'kg', topSetWeight: 60, e1rm: 70 }),
    ]);
    expect(records[0]!.weightUnit).toBe('kg');
  });

  it('preserves the weight unit from the source OneRepMaxPoint (lbs)', () => {
    const records = derivePersonalRecords([
      pt({ workoutId: 'w1', weightUnit: 'lbs', topSetWeight: 135, e1rm: 157 }),
    ]);
    expect(records[0]!.weightUnit).toBe('lbs');
  });

  it('fires a heavier-same-reps PR after a heavier low-rep non-PR updates the prior top set', () => {
    // Session 1: 100×5 (PR — first ever) — e1rm artificially high so it remains best across the series.
    // Session 2: 120×1 — heavier weight but lower reps and lower e1rm → not a PR, but should
    //                    update the tracked top-set record to (120, 1) so future comparisons
    //                    compare against the same prior record.
    // Session 3: 125×1 — heavier than the prior top-set weight at the SAME reps → must fire as
    //                    an absolute-weight PR with the paired tracker; would be missed if reps
    //                    were still pinned to the older 5-rep value.
    const records = derivePersonalRecords([
      pt({
        workoutId: 'w1',
        workoutDate: '2026-01-01T10:00:00Z',
        e1rm: 130,
        topSetWeight: 100,
        topSetReps: 5,
      }),
      pt({
        workoutId: 'w2',
        workoutDate: '2026-01-08T10:00:00Z',
        e1rm: 120,
        topSetWeight: 120,
        topSetReps: 1,
      }),
      pt({
        workoutId: 'w3',
        workoutDate: '2026-01-15T10:00:00Z',
        e1rm: 125,
        topSetWeight: 125,
        topSetReps: 1,
      }),
    ]);
    expect(records.map((r) => r.workoutDate)).toEqual([
      '2026-01-01T10:00:00Z',
      '2026-01-15T10:00:00Z',
    ]);
    const third = records.find((r) => r.workoutDate === '2026-01-15T10:00:00Z')!;
    expect(third.topSetWeight).toBe(125);
    expect(third.topSetReps).toBe(1);
  });
});
