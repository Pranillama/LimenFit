import { describe, expect, it } from 'vitest';
import { estimateOneRepMax, computeOneRepMaxSeries } from '../oneRepMax';
import type { ExerciseHistorySample } from '../types';

describe('estimateOneRepMax', () => {
  it('returns weight unchanged for 1 rep', () => {
    expect(estimateOneRepMax(100, 1)).toBe(100);
    expect(estimateOneRepMax(60, 1)).toBe(60);
  });

  it('clamps reps ≤ 0 to 1 and returns weight unchanged', () => {
    expect(estimateOneRepMax(100, 0)).toBe(100);
    expect(estimateOneRepMax(100, -5)).toBe(100);
  });

  it('applies Epley formula for reps > 1', () => {
    // w * (1 + reps / 30)
    expect(estimateOneRepMax(100, 10)).toBeCloseTo(100 * (1 + 10 / 30));
    expect(estimateOneRepMax(80, 5)).toBeCloseTo(80 * (1 + 5 / 30));
    expect(estimateOneRepMax(50, 30)).toBeCloseTo(50 * (1 + 30 / 30));
  });

  it('produces a higher estimate for more reps at the same weight', () => {
    expect(estimateOneRepMax(100, 5)).toBeLessThan(estimateOneRepMax(100, 10));
  });
});

function makeSample(
  overrides: Partial<ExerciseHistorySample> & { sets?: ExerciseHistorySample['sets'] } = {},
): ExerciseHistorySample {
  return {
    exerciseId: 'bench-press',
    exerciseName: 'Bench Press',
    muscleGroup: 'chest',
    workoutId: 'w1',
    workoutDate: '2024-01-15T10:00:00Z',
    sets: [{ id: 's1', weight: 100, reps: 5, weightUnit: 'kg' }],
    ...overrides,
  };
}

describe('computeOneRepMaxSeries', () => {
  it('returns empty array for empty input', () => {
    expect(computeOneRepMaxSeries([])).toEqual([]);
  });

  it('returns empty array when all samples have no sets', () => {
    expect(computeOneRepMaxSeries([makeSample({ sets: [] })])).toEqual([]);
  });

  it('computes e1RM for a single-set sample', () => {
    const point = computeOneRepMaxSeries([
      makeSample({ sets: [{ id: 's1', weight: 100, reps: 1, weightUnit: 'kg' }] }),
    ])[0]!;
    expect(point.e1rm).toBe(100);
    expect(point.weightUnit).toBe('kg');
    expect(point.exerciseId).toBe('bench-press');
  });

  it('picks the max e1RM across multiple sets', () => {
    const point = computeOneRepMaxSeries([
      makeSample({
        sets: [
          { id: 's1', weight: 80, reps: 10, weightUnit: 'kg' }, // e1RM ≈ 106.7
          { id: 's2', weight: 90, reps: 5, weightUnit: 'kg' }, // e1RM = 105
          { id: 's3', weight: 100, reps: 1, weightUnit: 'kg' }, // e1RM = 100
        ],
      }),
    ])[0]!;
    expect(point.e1rm).toBeCloseTo(80 * (1 + 10 / 30));
    expect(point.weightUnit).toBe('kg');
  });

  it('skips sets with weight ≤ 0', () => {
    const result = computeOneRepMaxSeries([
      makeSample({ sets: [{ id: 's1', weight: 0, reps: 5, weightUnit: 'kg' }] }),
    ]);
    expect(result).toHaveLength(0);
  });

  it('uses dominant unit and ignores minority-unit sets', () => {
    // 3 kg sets vs 1 lb set — kg dominates
    const point = computeOneRepMaxSeries([
      makeSample({
        sets: [
          { id: 's1', weight: 100, reps: 5, weightUnit: 'kg' },
          { id: 's2', weight: 105, reps: 3, weightUnit: 'kg' },
          { id: 's3', weight: 110, reps: 1, weightUnit: 'kg' },
          { id: 's4', weight: 300, reps: 5, weightUnit: 'lbs' }, // should be ignored
        ],
      }),
    ])[0]!;
    // Best kg set: 100 × (1 + 5/30) ≈ 116.67 — higher than 110 × 1 = 110
    expect(point.e1rm).toBeCloseTo(100 * (1 + 5 / 30));
    expect(point.weightUnit).toBe('kg');
  });

  it('drops sample when unit split is exactly even and no preferredUnit supplied', () => {
    const result = computeOneRepMaxSeries([
      makeSample({
        sets: [
          { id: 's1', weight: 100, reps: 5, weightUnit: 'kg' },
          { id: 's2', weight: 100, reps: 5, weightUnit: 'lbs' },
        ],
      }),
    ]);
    expect(result).toHaveLength(0);
  });

  it('uses preferredUnit to break ties', () => {
    const point = computeOneRepMaxSeries(
      [
        makeSample({
          sets: [
            { id: 's1', weight: 100, reps: 5, weightUnit: 'kg' },
            { id: 's2', weight: 225, reps: 5, weightUnit: 'lbs' },
          ],
        }),
      ],
      { preferredUnit: 'lbs' },
    )[0]!;
    expect(point.weightUnit).toBe('lbs');
    expect(point.e1rm).toBeCloseTo(225 * (1 + 5 / 30));
  });

  it('produces one point per sample (multiple workouts, same exercise)', () => {
    const samples: ExerciseHistorySample[] = [
      makeSample({ workoutId: 'w1', workoutDate: '2024-01-10T10:00:00Z' }),
      makeSample({ workoutId: 'w2', workoutDate: '2024-01-17T10:00:00Z' }),
      makeSample({ workoutId: 'w3', workoutDate: '2024-01-24T10:00:00Z' }),
    ];
    expect(computeOneRepMaxSeries(samples)).toHaveLength(3);
  });

  it('preserves workoutId, workoutDate, exerciseName on output', () => {
    const point = computeOneRepMaxSeries([makeSample()])[0]!;
    expect(point.workoutId).toBe('w1');
    expect(point.workoutDate).toBe('2024-01-15T10:00:00Z');
    expect(point.exerciseName).toBe('Bench Press');
  });

  it('exposes topSetWeight and topSetReps for the heaviest set', () => {
    const point = computeOneRepMaxSeries([
      makeSample({
        sets: [
          { id: 's1', weight: 80, reps: 10, weightUnit: 'kg' }, // higher e1RM but lighter
          { id: 's2', weight: 110, reps: 1, weightUnit: 'kg' }, // heaviest set
        ],
      }),
    ])[0]!;
    expect(point.topSetWeight).toBe(110);
    expect(point.topSetReps).toBe(1);
  });

  it('merges duplicate workout-exercise rows into one point with best e1RM', () => {
    const samples: ExerciseHistorySample[] = [
      makeSample({ workoutId: 'w1', sets: [{ id: 's1', weight: 100, reps: 5, weightUnit: 'kg' }] }),
      // Same workout, same exercise — second occurrence (e.g. from a duplicate DB row)
      makeSample({ workoutId: 'w1', sets: [{ id: 's2', weight: 110, reps: 3, weightUnit: 'kg' }] }),
    ];
    const result = computeOneRepMaxSeries(samples);
    expect(result).toHaveLength(1);
    // Best e1RM across both sets: 110×3 ≈ 121 vs 100×5 ≈ 116.7
    expect(result[0]!.e1rm).toBeCloseTo(estimateOneRepMax(110, 3));
    expect(result[0]!.topSetWeight).toBe(110);
  });
});
