import { describe, it, expect } from 'vitest';
import { buildWorkoutDetailDTO } from '../workoutDetailDTO';

const BASE_WORKOUT = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  name: 'Morning Push',
  status: 'completed' as const,
  started_at: '2026-05-06T08:00:00Z',
  completed_at: '2026-05-06T09:00:00Z',
  expired_at: null,
  last_activity_at: '2026-05-06T09:00:00Z',
  plan_workout_id: null,
  workout_exercises: [],
};

describe('buildWorkoutDetailDTO', () => {
  it('maps scalar workout fields to the DTO', () => {
    const dto = buildWorkoutDetailDTO(BASE_WORKOUT, null);
    expect(dto.id).toBe(BASE_WORKOUT.id);
    expect(dto.name).toBe('Morning Push');
    expect(dto.status).toBe('completed');
    expect(dto.started_at).toBe(BASE_WORKOUT.started_at);
    expect(dto.completed_at).toBe(BASE_WORKOUT.completed_at);
    expect(dto.plan_workout_id).toBeNull();
    expect(dto.planName).toBeNull();
  });

  it('sets planName from the plan row', () => {
    const dto = buildWorkoutDetailDTO(
      { ...BASE_WORKOUT, plan_workout_id: 'pw-1' },
      { planName: 'Strength A' },
    );
    expect(dto.planName).toBe('Strength A');
  });

  it('sorts exercises by position ascending', () => {
    const workout = {
      ...BASE_WORKOUT,
      workout_exercises: [
        { id: 'we-2', exercise_id: 'ex-b', position: 2, sets: [] },
        { id: 'we-1', exercise_id: 'ex-a', position: 1, sets: [] },
        { id: 'we-3', exercise_id: 'ex-c', position: null, sets: [] },
      ],
    };
    const dto = buildWorkoutDetailDTO(workout, null);
    expect(dto.exercises.map((e) => e.id)).toEqual(['we-3', 'we-1', 'we-2']);
  });

  it('sorts sets within an exercise by set_number ascending', () => {
    const workout = {
      ...BASE_WORKOUT,
      workout_exercises: [
        {
          id: 'we-1',
          exercise_id: 'ex-a',
          position: 1,
          sets: [
            { id: 's3', set_number: 3, weight_value: 100, weight_unit: 'lbs', reps: 8 },
            { id: 's1', set_number: 1, weight_value: 90, weight_unit: 'lbs', reps: 10 },
            { id: 's2', set_number: 2, weight_value: 95, weight_unit: 'lbs', reps: 9 },
          ],
        },
      ],
    };
    const dto = buildWorkoutDetailDTO(workout, null);
    expect(dto.exercises.at(0)!.sets.map((s) => s.localId)).toEqual(['s1', 's2', 's3']);
  });

  it('maps set.id to localId', () => {
    const workout = {
      ...BASE_WORKOUT,
      workout_exercises: [
        {
          id: 'we-1',
          exercise_id: 'ex-a',
          position: 1,
          sets: [{ id: 'set-uuid-1', set_number: 1, weight_value: 80, weight_unit: 'kg', reps: 5 }],
        },
      ],
    };
    const dto = buildWorkoutDetailDTO(workout, null);
    expect(dto.exercises.at(0)!.sets.at(0)!.localId).toBe('set-uuid-1');
  });

  it('handles null set fields gracefully', () => {
    const workout = {
      ...BASE_WORKOUT,
      workout_exercises: [
        {
          id: 'we-1',
          exercise_id: 'ex-a',
          position: 1,
          sets: [{ id: 's1', set_number: 1, weight_value: null, weight_unit: null, reps: null }],
        },
      ],
    };
    const dto = buildWorkoutDetailDTO(workout, null);
    const s = dto.exercises.at(0)!.sets.at(0)!;
    expect(s.weight_value).toBeNull();
    expect(s.weight_unit).toBeNull();
    expect(s.reps).toBeNull();
  });
});
