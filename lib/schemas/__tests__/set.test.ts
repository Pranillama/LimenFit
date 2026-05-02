import { describe, it, expect } from 'vitest';
import { setLogBodySchema, setEditBodySchema, setDeleteBodySchema } from '../set';

const UUID = '550e8400-e29b-41d4-a716-446655440000';
const ISO  = '2026-05-01T10:00:00.000Z';

describe('setLogBodySchema', () => {
  it('parses a valid body', () => {
    const result = setLogBodySchema.safeParse({
      clientMutationId: UUID,
      localId: UUID,
      workoutExerciseId: UUID,
      setNumber: 1,
      reps: 10,
      weightValue: 60.5,
      weightUnit: 'kg',
      loggedAt: ISO,
    });
    expect(result.success).toBe(true);
  });

  it('rejects a non-UUID clientMutationId', () => {
    const result = setLogBodySchema.safeParse({
      clientMutationId: 'bad',
      localId: UUID,
      workoutExerciseId: UUID,
      setNumber: 1,
      reps: 10,
      weightValue: 60,
      weightUnit: 'kg',
      loggedAt: ISO,
    });
    expect(result.success).toBe(false);
  });

  it('rejects setNumber < 1', () => {
    const result = setLogBodySchema.safeParse({
      clientMutationId: UUID,
      localId: UUID,
      workoutExerciseId: UUID,
      setNumber: 0,
      reps: 10,
      weightValue: 60,
      weightUnit: 'kg',
      loggedAt: ISO,
    });
    expect(result.success).toBe(false);
  });

  it('rejects an invalid weightUnit', () => {
    const result = setLogBodySchema.safeParse({
      clientMutationId: UUID,
      localId: UUID,
      workoutExerciseId: UUID,
      setNumber: 1,
      reps: 10,
      weightValue: 60,
      weightUnit: 'stone',
      loggedAt: ISO,
    });
    expect(result.success).toBe(false);
  });

  it('accepts weightUnit "lbs"', () => {
    const result = setLogBodySchema.safeParse({
      clientMutationId: UUID,
      localId: UUID,
      workoutExerciseId: UUID,
      setNumber: 1,
      reps: 10,
      weightValue: 135,
      weightUnit: 'lbs',
      loggedAt: ISO,
    });
    expect(result.success).toBe(true);
  });
});

describe('setEditBodySchema', () => {
  it('parses a valid body with reps only', () => {
    expect(setEditBodySchema.safeParse({ clientMutationId: UUID, reps: 12 }).success).toBe(true);
  });

  it('parses a valid body with all optional fields', () => {
    const result = setEditBodySchema.safeParse({
      clientMutationId: UUID,
      reps: 12,
      weightValue: 70,
      weightUnit: 'kg',
    });
    expect(result.success).toBe(true);
  });

  it('rejects a body with only clientMutationId (no edit field provided)', () => {
    const result = setEditBodySchema.safeParse({ clientMutationId: UUID });
    expect(result.success).toBe(false);
  });

  it('rejects a non-UUID clientMutationId', () => {
    expect(setEditBodySchema.safeParse({ clientMutationId: 'x', reps: 5 }).success).toBe(false);
  });
});

describe('setDeleteBodySchema', () => {
  it('parses a valid body', () => {
    expect(setDeleteBodySchema.safeParse({ clientMutationId: UUID }).success).toBe(true);
  });

  it('rejects a non-UUID clientMutationId', () => {
    expect(setDeleteBodySchema.safeParse({ clientMutationId: 'x' }).success).toBe(false);
  });
});
