import { describe, expect, it } from 'vitest';
import { computeVolumeTrend } from '../volumeTrend';
import type { ExerciseHistorySample } from '../types';

function sample(
  exerciseId: string,
  workoutDate: string,
  weight: number,
  reps: number,
  muscleGroup: ExerciseHistorySample['muscleGroup'] = 'chest',
): ExerciseHistorySample {
  return {
    exerciseId,
    exerciseName: exerciseId,
    muscleGroup,
    workoutId: `w-${workoutDate}-${exerciseId}`,
    workoutDate,
    sets: [{ id: 's1', weight, reps, weightUnit: 'kg' }],
  };
}

describe('computeVolumeTrend', () => {
  it('returns empty array for empty input', () => {
    expect(computeVolumeTrend([], { groupBy: 'exerciseId', weeks: 4 })).toEqual([]);
  });

  it('produces one point per exerciseId per week in the contiguous window', () => {
    const samples = [
      sample('bench', '2024-01-15T10:00:00Z', 100, 5), // week of Jan 15
      sample('bench', '2024-01-22T10:00:00Z', 100, 5), // week of Jan 22
    ];
    // Latest observed: Jan 22; 4-week window: Jan 1, Jan 8, Jan 15, Jan 22
    const points = computeVolumeTrend(samples, { groupBy: 'exerciseId', weeks: 4 });
    expect(points).toHaveLength(4);
    expect(points.every((p) => p.groupKey === 'bench')).toBe(true);
  });

  it('sums volume across multiple sets in the same week', () => {
    const multi: ExerciseHistorySample = {
      exerciseId: 'squat',
      exerciseName: 'Squat',
      muscleGroup: 'legs',
      workoutId: 'w1',
      workoutDate: '2024-01-15T10:00:00Z',
      sets: [
        { id: 's1', weight: 100, reps: 5, weightUnit: 'kg' }, // 500
        { id: 's2', weight: 120, reps: 3, weightUnit: 'kg' }, // 360
        { id: 's3', weight: 80, reps: 8, weightUnit: 'kg' }, // 640
      ],
    };
    const points = computeVolumeTrend([multi], { groupBy: 'exerciseId', weeks: 4 });
    const jan15 = points.find((p) => p.weekStart === '2024-01-15')!;
    expect(jan15.totalVolume).toBe(1500);
  });

  it('sums volume from two workouts in the same week', () => {
    // Both dates land on the week of 2024-01-15 (Monday)
    const samples = [
      sample('bench', '2024-01-15T10:00:00Z', 100, 5), // 500
      sample('bench', '2024-01-18T10:00:00Z', 80, 8), // 640, same week
    ];
    // Latest observed: Jan 15; 4-week window includes Dec 25, Jan 1, Jan 8, Jan 15
    const points = computeVolumeTrend(samples, { groupBy: 'exerciseId', weeks: 4 });
    expect(points).toHaveLength(4);
    const jan15 = points.find((p) => p.weekStart === '2024-01-15')!;
    expect(jan15.totalVolume).toBe(1140);
  });

  it('sets deltaVolume to null for the first week in the output window', () => {
    // Single sample at Jan 15; 4-week window starts at Dec 25 (zero-filled)
    const points = computeVolumeTrend([sample('bench', '2024-01-15T10:00:00Z', 100, 5)], {
      groupBy: 'exerciseId',
      weeks: 4,
    });
    expect(points[0]!.deltaVolume).toBeNull();
    expect(points[0]!.direction).toBe('flat');
  });

  it('computes delta and direction across consecutive weeks', () => {
    const samples = [
      sample('bench', '2024-01-08T10:00:00Z', 100, 5), // week 1: 500
      sample('bench', '2024-01-15T10:00:00Z', 110, 5), // week 2: 550 → +10% → up
      sample('bench', '2024-01-22T10:00:00Z', 105, 5), // week 3: 525 → -4.5% → flat
      sample('bench', '2024-01-29T10:00:00Z', 90, 5), // week 4: 450 → -14% → down
    ];
    const points = computeVolumeTrend(samples, { groupBy: 'exerciseId', weeks: 4 });
    expect(points[0]!.direction).toBe('flat'); // no prior
    expect(points[1]!.direction).toBe('up');
    expect(points[2]!.direction).toBe('flat');
    expect(points[3]!.direction).toBe('down');
  });

  it('flat direction when |delta| is exactly at the 5% boundary', () => {
    // 500 → 525: +5% → flat (boundary is exclusive at exactly 5%)
    const samples = [
      sample('bench', '2024-01-08T10:00:00Z', 100, 5),
      sample('bench', '2024-01-15T10:00:00Z', 105, 5),
    ];
    const points = computeVolumeTrend(samples, { groupBy: 'exerciseId', weeks: 4 });
    const jan15 = points.find((p) => p.weekStart === '2024-01-15')!;
    expect(jan15.direction).toBe('flat');
  });

  it('groups by muscleGroup when requested', () => {
    const samples = [
      sample('bench', '2024-01-15T10:00:00Z', 100, 5, 'chest'), // chest: 500
      sample('incline', '2024-01-15T10:00:00Z', 80, 5, 'chest'), // chest: +400 = 900
      sample('squat', '2024-01-15T10:00:00Z', 120, 5, 'legs'), // legs: 600
    ];
    const points = computeVolumeTrend(samples, { groupBy: 'muscleGroup', weeks: 4 });
    // With contiguous weeks, find the specific week that has the volume
    const chestPoint = points.find((p) => p.groupKey === 'chest' && p.weekStart === '2024-01-15');
    const legsPoint = points.find((p) => p.groupKey === 'legs' && p.weekStart === '2024-01-15');
    expect(chestPoint?.totalVolume).toBe(900);
    expect(legsPoint?.totalVolume).toBe(600);
  });

  it('respects the weeks limit and drops older buckets', () => {
    const samples = [
      sample('bench', '2023-12-04T10:00:00Z', 100, 5), // 7 weeks before Jan 22
      sample('bench', '2023-12-11T10:00:00Z', 100, 5), // 6 weeks before
      sample('bench', '2023-12-18T10:00:00Z', 100, 5),
      sample('bench', '2023-12-25T10:00:00Z', 100, 5),
      sample('bench', '2024-01-01T10:00:00Z', 100, 5),
      sample('bench', '2024-01-08T10:00:00Z', 100, 5),
      sample('bench', '2024-01-15T10:00:00Z', 100, 5), // most recent week
    ];
    // With weeks: 4 we should get 4 points (most recent 4 weeks)
    const points = computeVolumeTrend(samples, { groupBy: 'exerciseId', weeks: 4 });
    expect(points).toHaveLength(4);
    // Dec 25 2023 is a Monday, so it is a valid week bucket; the oldest of the
    // last 4 is Dec 25 (Dec 25, Jan 1, Jan 8, Jan 15).
    expect(points[0]!.weekStart).toBe('2023-12-25');
  });

  it('fills a missing week with zero volume so delta compares true week-over-week', () => {
    // Jan 8: 500; Jan 15 missing (no workout); Jan 22: 500
    const samples = [
      sample('bench', '2024-01-08T10:00:00Z', 100, 5),
      sample('bench', '2024-01-22T10:00:00Z', 100, 5),
    ];
    // Latest: Jan 22; 3-week window: Jan 8, Jan 15, Jan 22
    const points = computeVolumeTrend(samples, { groupBy: 'exerciseId', weeks: 3 });
    expect(points).toHaveLength(3);
    const jan15 = points.find((p) => p.weekStart === '2024-01-15')!;
    const jan22 = points.find((p) => p.weekStart === '2024-01-22')!;
    // Filled zero-volume week
    expect(jan15.totalVolume).toBe(0);
    expect(jan15.direction).toBe('down'); // 0 after 500 → -100%
    // Jan 22 delta is against the filled Jan 15 (0), not the observed Jan 8 (500)
    expect(jan22.deltaVolume).toBe(500);
    expect(jan22.direction).toBe('up'); // non-zero after zero prev → up
  });

  it('direction for consecutive filled zero-volume weeks is flat', () => {
    // Single observed week; prior weeks in window are all zero-filled
    const samples = [sample('bench', '2024-01-22T10:00:00Z', 100, 5)];
    // 3-week window: Jan 8, Jan 15, Jan 22
    const points = computeVolumeTrend(samples, { groupBy: 'exerciseId', weeks: 3 });
    expect(points).toHaveLength(3);
    const jan8 = points.find((p) => p.weekStart === '2024-01-08')!;
    const jan15 = points.find((p) => p.weekStart === '2024-01-15')!;
    expect(jan8.deltaVolume).toBeNull(); // first in window
    expect(jan15.totalVolume).toBe(0);
    expect(jan15.deltaVolume).toBe(0);
    expect(jan15.direction).toBe('flat');
  });

  it('handles a week containing the DST spring-forward transition', () => {
    // US DST spring-forward 2024: March 10 at 2am (Sunday)
    // Week of Mon Mar 11 – Sun Mar 17 spans the transition
    const samples = [
      sample('bench', '2024-03-04T10:00:00Z', 100, 5), // week of Mar 4
      sample('bench', '2024-03-11T10:00:00Z', 100, 5), // week of Mar 11 (DST week)
    ];
    // Latest: Mar 11; 4-week window: Feb 19, Feb 26, Mar 4, Mar 11
    const points = computeVolumeTrend(samples, { groupBy: 'exerciseId', weeks: 4 });
    expect(points).toHaveLength(4);
    const mar4 = points.find((p) => p.weekStart === '2024-03-04')!;
    const mar11 = points.find((p) => p.weekStart === '2024-03-11')!;
    // Volumes should be equal (no data corruption across DST boundary)
    expect(mar4.totalVolume).toBe(500);
    expect(mar11.totalVolume).toBe(500);
  });
});
