import { describe, it, expect } from 'vitest';
import {
  workoutCreateBodySchema,
  workoutPatchBodySchema,
  workoutDiscardBodySchema,
  workoutRestoreBodySchema,
} from '../workout';

const UUID = '550e8400-e29b-41d4-a716-446655440000';
const ISO  = '2026-05-01T10:00:00.000Z';

describe('workoutCreateBodySchema', () => {
  it('parses a valid body', () => {
    const result = workoutCreateBodySchema.safeParse({
      clientMutationId: UUID,
      localId: UUID,
      name: 'Leg Day',
      planWorkoutId: null,
      originPlanWorkoutId: null,
      startedAt: ISO,
      lastActivityAt: ISO,
    });
    expect(result.success).toBe(true);
  });

  it('rejects a non-UUID clientMutationId', () => {
    const result = workoutCreateBodySchema.safeParse({
      clientMutationId: 'not-a-uuid',
      localId: UUID,
      name: null,
      planWorkoutId: null,
      originPlanWorkoutId: null,
      startedAt: ISO,
      lastActivityAt: ISO,
    });
    expect(result.success).toBe(false);
  });

  it('rejects a missing startedAt', () => {
    const result = workoutCreateBodySchema.safeParse({
      clientMutationId: UUID,
      localId: UUID,
      name: null,
      planWorkoutId: null,
      originPlanWorkoutId: null,
      lastActivityAt: ISO,
    });
    expect(result.success).toBe(false);
  });
});

describe('workoutPatchBodySchema', () => {
  it('parses a valid body with optional fields', () => {
    const result = workoutPatchBodySchema.safeParse({
      clientMutationId: UUID,
      name: 'Upper Body',
      status: 'completed',
      lastActivityAt: ISO,
    });
    expect(result.success).toBe(true);
  });

  it('parses a body with only clientMutationId (all optionals absent)', () => {
    const result = workoutPatchBodySchema.safeParse({ clientMutationId: UUID });
    expect(result.success).toBe(true);
  });

  it('rejects status: "expired" (cron-only transition)', () => {
    const result = workoutPatchBodySchema.safeParse({
      clientMutationId: UUID,
      status: 'expired',
    });
    expect(result.success).toBe(false);
  });

  it('rejects a non-UUID clientMutationId', () => {
    const result = workoutPatchBodySchema.safeParse({ clientMutationId: 'bad' });
    expect(result.success).toBe(false);
  });
});

describe('workoutDiscardBodySchema', () => {
  it('parses a valid body', () => {
    expect(workoutDiscardBodySchema.safeParse({ clientMutationId: UUID }).success).toBe(true);
  });

  it('rejects a non-UUID clientMutationId', () => {
    expect(workoutDiscardBodySchema.safeParse({ clientMutationId: 'x' }).success).toBe(false);
  });
});

describe('workoutRestoreBodySchema', () => {
  it('parses a valid body', () => {
    expect(workoutRestoreBodySchema.safeParse({ clientMutationId: UUID }).success).toBe(true);
  });

  it('rejects a non-UUID clientMutationId', () => {
    expect(workoutRestoreBodySchema.safeParse({ clientMutationId: 'x' }).success).toBe(false);
  });
});
