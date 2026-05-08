import { describe, it, expect } from 'vitest';
import { buildPlanWorkoutFromHistory } from '../importFromHistory';

const EX_SQUAT = '00000000-0000-4000-8000-000000000001';
const EX_BENCH = '00000000-0000-4000-8000-000000000002';
const EX_ROW   = '00000000-0000-4000-8000-000000000003';

describe('buildPlanWorkoutFromHistory', () => {
  it('maps sets.length to targetSets and last set reps to targetReps', () => {
    const result = buildPlanWorkoutFromHistory(
      {
        name: 'Monday Push',
        workout_exercises: [
          {
            exercise_id: EX_SQUAT,
            position: 0,
            sets: [
              { set_number: 1, reps: 8 },
              { set_number: 2, reps: 10 },
              { set_number: 3, reps: 12 },
            ],
          },
        ],
      },
      0,
    );

    expect(result.exercises[0].targetSets).toBe(3);
    expect(result.exercises[0].targetReps).toBe(12);
  });

  it('uses reps from last set by set_number regardless of array order', () => {
    const result = buildPlanWorkoutFromHistory(
      {
        name: 'Test',
        workout_exercises: [
          {
            exercise_id: EX_SQUAT,
            position: 0,
            sets: [
              { set_number: 3, reps: 5 },
              { set_number: 1, reps: 10 },
              { set_number: 2, reps: 8 },
            ],
          },
        ],
      },
      0,
    );

    expect(result.exercises[0].targetReps).toBe(5);
  });

  it('defaults to targetSets=1 targetReps=0 when sets is empty', () => {
    const result = buildPlanWorkoutFromHistory(
      {
        name: 'Test',
        workout_exercises: [
          { exercise_id: EX_SQUAT, position: 0, sets: [] },
        ],
      },
      0,
    );

    expect(result.exercises[0].targetSets).toBe(1);
    expect(result.exercises[0].targetReps).toBe(0);
  });

  it('defaults to targetSets=1 targetReps=0 when all reps are null', () => {
    const result = buildPlanWorkoutFromHistory(
      {
        name: 'Test',
        workout_exercises: [
          {
            exercise_id: EX_SQUAT,
            position: 0,
            sets: [
              { set_number: 1, reps: null },
              { set_number: 2, reps: null },
            ],
          },
        ],
      },
      0,
    );

    expect(result.exercises[0].targetSets).toBe(1);
    expect(result.exercises[0].targetReps).toBe(0);
  });

  it('uses last performed (non-null) reps when final set has null reps', () => {
    const result = buildPlanWorkoutFromHistory(
      {
        name: 'Test',
        workout_exercises: [
          {
            exercise_id: EX_SQUAT,
            position: 0,
            sets: [
              { set_number: 1, reps: 8 },
              { set_number: 2, reps: null },
            ],
          },
        ],
      },
      0,
    );

    expect(result.exercises[0].targetSets).toBe(2);
    expect(result.exercises[0].targetReps).toBe(8);
  });

  it('falls back name to "Imported workout" when workout name is null', () => {
    const result = buildPlanWorkoutFromHistory(
      {
        name: null,
        workout_exercises: [
          { exercise_id: EX_SQUAT, position: 0, sets: [{ set_number: 1, reps: 5 }] },
        ],
      },
      0,
    );

    expect(result.name).toBe('Imported workout');
  });

  it('falls back name to "Imported workout" when workout name is blank', () => {
    const result = buildPlanWorkoutFromHistory(
      {
        name: '   ',
        workout_exercises: [
          { exercise_id: EX_SQUAT, position: 0, sets: [{ set_number: 1, reps: 5 }] },
        ],
      },
      0,
    );

    expect(result.name).toBe('Imported workout');
  });

  it('trims whitespace from workout name', () => {
    const result = buildPlanWorkoutFromHistory(
      {
        name: '  Upper Body  ',
        workout_exercises: [
          { exercise_id: EX_SQUAT, position: 0, sets: [{ set_number: 1, reps: 5 }] },
        ],
      },
      0,
    );

    expect(result.name).toBe('Upper Body');
  });

  it('sorts exercises by position and assigns sequential positions to output', () => {
    const result = buildPlanWorkoutFromHistory(
      {
        name: 'Full Body',
        workout_exercises: [
          { exercise_id: EX_ROW,   position: 2, sets: [{ set_number: 1, reps: 8 }] },
          { exercise_id: EX_SQUAT, position: 0, sets: [{ set_number: 1, reps: 5 }] },
          { exercise_id: EX_BENCH, position: 1, sets: [{ set_number: 1, reps: 6 }] },
        ],
      },
      0,
    );

    expect(result.exercises.map((e) => e.exerciseId)).toEqual([EX_SQUAT, EX_BENCH, EX_ROW]);
    expect(result.exercises.map((e) => e.position)).toEqual([0, 1, 2]);
  });

  it('maps multiple workout_exercises to separate plan exercises', () => {
    const result = buildPlanWorkoutFromHistory(
      {
        name: 'Push',
        workout_exercises: [
          {
            exercise_id: EX_SQUAT,
            position: 0,
            sets: [{ set_number: 1, reps: 5 }, { set_number: 2, reps: 5 }],
          },
          {
            exercise_id: EX_BENCH,
            position: 1,
            sets: [{ set_number: 1, reps: 10 }, { set_number: 2, reps: 8 }, { set_number: 3, reps: 6 }],
          },
        ],
      },
      1,
    );

    expect(result.exercises).toHaveLength(2);
    expect(result.exercises[0]).toMatchObject({
      exerciseId: EX_SQUAT,
      targetSets: 2,
      targetReps: 5,
      position: 0,
    });
    expect(result.exercises[1]).toMatchObject({
      exerciseId: EX_BENCH,
      targetSets: 3,
      targetReps: 6,
      position: 1,
    });
  });

  it('passes through the position argument to the output workout', () => {
    const result = buildPlanWorkoutFromHistory(
      {
        name: 'Leg Day',
        workout_exercises: [
          { exercise_id: EX_SQUAT, position: 0, sets: [{ set_number: 1, reps: 5 }] },
        ],
      },
      3,
    );

    expect(result.position).toBe(3);
  });

  it('clamps targetSets to minimum 1 even when sets is empty', () => {
    const result = buildPlanWorkoutFromHistory(
      {
        name: 'Test',
        workout_exercises: [
          { exercise_id: EX_SQUAT, position: 0, sets: [] },
        ],
      },
      0,
    );

    expect(result.exercises[0].targetSets).toBeGreaterThanOrEqual(1);
  });

  it('drops a consecutive zero-set duplicate exercise', () => {
    const result = buildPlanWorkoutFromHistory(
      {
        name: 'Test',
        workout_exercises: [
          {
            exercise_id: EX_SQUAT,
            position: 0,
            sets: [{ set_number: 1, reps: 5 }, { set_number: 2, reps: 5 }, { set_number: 3, reps: 5 }],
          },
          { exercise_id: EX_SQUAT, position: 1, sets: [] },
        ],
      },
      0,
    );

    expect(result.exercises).toHaveLength(1);
    expect(result.exercises[0].exerciseId).toBe(EX_SQUAT);
    expect(result.exercises[0].targetSets).toBe(3);
  });

  it('keeps consecutive non-empty duplicate exercises as distinct plan exercises', () => {
    const result = buildPlanWorkoutFromHistory(
      {
        name: 'Test',
        workout_exercises: [
          {
            exercise_id: EX_SQUAT,
            position: 0,
            sets: [{ set_number: 1, reps: 5 }, { set_number: 2, reps: 5 }],
          },
          {
            exercise_id: EX_SQUAT,
            position: 1,
            sets: [{ set_number: 1, reps: 3 }],
          },
        ],
      },
      0,
    );

    expect(result.exercises).toHaveLength(2);
    expect(result.exercises[0]).toMatchObject({ exerciseId: EX_SQUAT, targetSets: 2, position: 0 });
    expect(result.exercises[1]).toMatchObject({ exerciseId: EX_SQUAT, targetSets: 1, position: 1 });
  });
});
