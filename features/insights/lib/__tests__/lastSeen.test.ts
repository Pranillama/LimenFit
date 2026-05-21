import { describe, expect, it } from 'vitest';
import { deriveLastSeenByGroup } from '../lastSeen';
import type { ExerciseHistorySample } from '../types';

function sample(overrides: Partial<ExerciseHistorySample>): ExerciseHistorySample {
  return {
    exerciseId: 'bench',
    exerciseName: 'Bench Press',
    muscleGroup: 'chest',
    sets: [],
    workoutId: 'w1',
    workoutDate: '2026-01-01T10:00:00Z',
    ...overrides,
  };
}

describe('deriveLastSeenByGroup', () => {
  it('returns an empty object for empty input', () => {
    expect(deriveLastSeenByGroup([])).toEqual({});
  });

  it('returns the latest date per muscle group', () => {
    const result = deriveLastSeenByGroup([
      sample({ muscleGroup: 'chest', workoutDate: '2026-01-01T10:00:00Z' }),
      sample({ muscleGroup: 'chest', workoutDate: '2026-01-10T10:00:00Z' }),
      sample({ muscleGroup: 'chest', workoutDate: '2026-01-05T10:00:00Z' }),
    ]);
    expect(result.chest).toBe('2026-01-10T10:00:00Z');
  });

  it('handles multiple muscle groups', () => {
    const result = deriveLastSeenByGroup([
      sample({ muscleGroup: 'chest', workoutDate: '2026-01-01T10:00:00Z' }),
      sample({ muscleGroup: 'legs', workoutDate: '2026-01-15T10:00:00Z' }),
      sample({ muscleGroup: 'back', workoutDate: '2026-01-07T10:00:00Z' }),
    ]);
    expect(result).toEqual({
      chest: '2026-01-01T10:00:00Z',
      legs: '2026-01-15T10:00:00Z',
      back: '2026-01-07T10:00:00Z',
    });
  });
});
