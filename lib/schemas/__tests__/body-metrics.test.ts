import { describe, it, expect } from 'vitest';

import { bodyweightLogBodySchema, measurementsPatchBodySchema } from '../body-metrics';

describe('bodyweightLogBodySchema', () => {
  it('accepts a positive weight', () => {
    expect(bodyweightLogBodySchema.parse({ weightKg: 84.5 })).toEqual({ weightKg: 84.5 });
  });

  it('rejects zero, negative, and over-max weights', () => {
    expect(bodyweightLogBodySchema.safeParse({ weightKg: 0 }).success).toBe(false);
    expect(bodyweightLogBodySchema.safeParse({ weightKg: -1 }).success).toBe(false);
    expect(bodyweightLogBodySchema.safeParse({ weightKg: 501 }).success).toBe(false);
  });
});

describe('measurementsPatchBodySchema', () => {
  it('accepts a partial update', () => {
    expect(measurementsPatchBodySchema.parse({ waistCm: 83.8 })).toEqual({ waistCm: 83.8 });
  });

  it('accepts null to clear a field', () => {
    expect(measurementsPatchBodySchema.parse({ bodyFatPct: null })).toEqual({ bodyFatPct: null });
  });

  it('rejects an empty object', () => {
    expect(measurementsPatchBodySchema.safeParse({}).success).toBe(false);
  });

  it('rejects body fat over 100', () => {
    expect(measurementsPatchBodySchema.safeParse({ bodyFatPct: 101 }).success).toBe(false);
  });
});
