import { describe, it, expect } from 'vitest';
import {
  workoutExerciseAddBodySchema,
  workoutExerciseReorderBodySchema,
  workoutExerciseDeleteBodySchema,
} from '../workout-exercise';

const UUID = '550e8400-e29b-41d4-a716-446655440000';

describe('workoutExerciseAddBodySchema', () => {
  it('parses a valid body', () => {
    const result = workoutExerciseAddBodySchema.safeParse({
      clientMutationId: UUID,
      localId: UUID,
      workoutId: UUID,
      exerciseId: UUID,
      position: 0,
    });
    expect(result.success).toBe(true);
  });

  it('rejects a non-UUID clientMutationId', () => {
    const result = workoutExerciseAddBodySchema.safeParse({
      clientMutationId: 'bad',
      localId: UUID,
      workoutId: UUID,
      exerciseId: UUID,
      position: 0,
    });
    expect(result.success).toBe(false);
  });

  it('rejects a negative position', () => {
    const result = workoutExerciseAddBodySchema.safeParse({
      clientMutationId: UUID,
      localId: UUID,
      workoutId: UUID,
      exerciseId: UUID,
      position: -1,
    });
    expect(result.success).toBe(false);
  });

  it('rejects a non-integer position', () => {
    const result = workoutExerciseAddBodySchema.safeParse({
      clientMutationId: UUID,
      localId: UUID,
      workoutId: UUID,
      exerciseId: UUID,
      position: 1.5,
    });
    expect(result.success).toBe(false);
  });
});

describe('workoutExerciseReorderBodySchema', () => {
  it('parses a valid body', () => {
    const result = workoutExerciseReorderBodySchema.safeParse({
      clientMutationId: UUID,
      position: 2,
    });
    expect(result.success).toBe(true);
  });

  it('rejects a non-UUID clientMutationId', () => {
    expect(
      workoutExerciseReorderBodySchema.safeParse({ clientMutationId: 'x', position: 0 }).success,
    ).toBe(false);
  });
});

describe('workoutExerciseDeleteBodySchema', () => {
  it('parses a valid body', () => {
    expect(
      workoutExerciseDeleteBodySchema.safeParse({ clientMutationId: UUID }).success,
    ).toBe(true);
  });

  it('rejects a non-UUID clientMutationId', () => {
    expect(
      workoutExerciseDeleteBodySchema.safeParse({ clientMutationId: 'x' }).success,
    ).toBe(false);
  });
});
