import { describe, expect, it } from 'vitest';
import { computeConsistencyScore } from '../consistency';
import type { WorkoutSample } from '../types';

function workout(startedAt: string, status: WorkoutSample['status'] = 'completed'): WorkoutSample {
  return { id: startedAt, startedAt, status, exercises: [] };
}

const NOW = new Date('2024-01-22T12:00:00Z'); // Monday Jan 22 2024 (local = UTC for these tests)

describe('computeConsistencyScore', () => {
  it('returns zeroes for empty input', () => {
    const result = computeConsistencyScore([], { now: NOW });
    expect(result.avgWorkoutsPerWeek).toBe(0);
    expect(result.streakWeeks).toBe(0);
    expect(result.weeksAnalyzed).toBe(4);
  });

  it('counts only completed workouts', () => {
    const workouts = [
      workout('2024-01-22T10:00:00Z', 'completed'),
      workout('2024-01-22T11:00:00Z', 'expired'),
    ];
    const result = computeConsistencyScore(workouts, { now: NOW });
    expect(result.avgWorkoutsPerWeek).toBe(1 / 4); // 1 completed over 4 weeks
  });

  it('counts workouts per week correctly', () => {
    const workouts = [
      // Week of Jan 22 (current): 3 workouts
      workout('2024-01-22T10:00:00Z'),
      workout('2024-01-23T10:00:00Z'),
      workout('2024-01-25T10:00:00Z'),
      // Week of Jan 15: 2 workouts
      workout('2024-01-15T10:00:00Z'),
      workout('2024-01-17T10:00:00Z'),
      // Week of Jan 8: 1 workout
      workout('2024-01-08T10:00:00Z'),
      // Week of Jan 1: 0 workouts
    ];
    const result = computeConsistencyScore(workouts, { now: NOW, weeks: 4 });
    // (3 + 2 + 1 + 0) / 4 = 1.5
    expect(result.avgWorkoutsPerWeek).toBe(1.5);
  });

  it('ignores workouts outside the analysis window', () => {
    const workouts = [
      workout('2023-12-01T10:00:00Z'), // way before the window
      workout('2024-01-22T10:00:00Z'), // in window
    ];
    const result = computeConsistencyScore(workouts, { now: NOW, weeks: 4 });
    expect(result.avgWorkoutsPerWeek).toBe(1 / 4);
  });

  it('computes streakWeeks with target=3', () => {
    const workouts = [
      // Jan 1 week: 1 (miss)
      workout('2024-01-01T10:00:00Z'),
      // Jan 8 week: 3 (hit)
      workout('2024-01-08T10:00:00Z'),
      workout('2024-01-09T10:00:00Z'),
      workout('2024-01-10T10:00:00Z'),
      // Jan 15 week: 4 (hit)
      workout('2024-01-15T10:00:00Z'),
      workout('2024-01-16T10:00:00Z'),
      workout('2024-01-17T10:00:00Z'),
      workout('2024-01-18T10:00:00Z'),
      // Jan 22 week: 3 (hit)
      workout('2024-01-22T10:00:00Z'),
      workout('2024-01-23T10:00:00Z'),
      workout('2024-01-24T10:00:00Z'),
    ];
    const result = computeConsistencyScore(workouts, { now: NOW, weeks: 4, targetPerWeek: 3 });
    // Streak counts from most recent: Jan22=hit, Jan15=hit, Jan8=hit → streak=3
    // Jan1=miss stops it
    expect(result.streakWeeks).toBe(3);
  });

  it('streak is 0 when most recent week misses the target', () => {
    const workouts = [
      // Jan 8 week: 5 (hit)
      workout('2024-01-08T10:00:00Z'),
      workout('2024-01-09T10:00:00Z'),
      workout('2024-01-10T10:00:00Z'),
      workout('2024-01-11T10:00:00Z'),
      workout('2024-01-12T10:00:00Z'),
      // Jan 15 week: 0 (miss)
      // Jan 22 week: 1 (miss)
      workout('2024-01-22T10:00:00Z'),
    ];
    const result = computeConsistencyScore(workouts, { now: NOW, weeks: 4, targetPerWeek: 3 });
    expect(result.streakWeeks).toBe(0);
  });

  it('streak equals weeks when all weeks meet the target', () => {
    const workouts: WorkoutSample[] = [
      workout('2024-01-01T10:00:00Z'),
      workout('2024-01-02T10:00:00Z'),
      workout('2024-01-03T10:00:00Z'),
      workout('2024-01-08T10:00:00Z'),
      workout('2024-01-09T10:00:00Z'),
      workout('2024-01-10T10:00:00Z'),
      workout('2024-01-15T10:00:00Z'),
      workout('2024-01-16T10:00:00Z'),
      workout('2024-01-17T10:00:00Z'),
      workout('2024-01-22T10:00:00Z'),
      workout('2024-01-23T10:00:00Z'),
      workout('2024-01-24T10:00:00Z'),
    ];
    const result = computeConsistencyScore(workouts, { now: NOW, weeks: 4, targetPerWeek: 3 });
    expect(result.streakWeeks).toBe(4);
  });

  it('uses default weeks=4 and targetPerWeek=3', () => {
    const result = computeConsistencyScore([], { now: NOW });
    expect(result.weeksAnalyzed).toBe(4);
    expect(result.streakWeeks).toBe(0);
  });

  it('respects custom weeks param', () => {
    const result = computeConsistencyScore([], { now: NOW, weeks: 8 });
    expect(result.weeksAnalyzed).toBe(8);
  });

  it('handles weeks=0 without dividing by zero', () => {
    const result = computeConsistencyScore([], { now: NOW, weeks: 0 });
    expect(result.avgWorkoutsPerWeek).toBe(0);
    expect(result.weeksAnalyzed).toBe(0);
  });

  it('buckets a workout on a Sunday into the preceding Monday week', () => {
    // 2024-01-21 is a Sunday — should fall in the week starting 2024-01-15
    const result = computeConsistencyScore(
      [workout('2024-01-21T10:00:00Z')], // Sunday
      { now: NOW, weeks: 4 },
    );
    // avg = 1 workout in the Jan-15 week / 4
    expect(result.avgWorkoutsPerWeek).toBe(1 / 4);
  });
});
