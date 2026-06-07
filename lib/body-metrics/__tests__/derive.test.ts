import { describe, it, expect } from 'vitest';

import { computeBmi, bmiCategory, weightDelta } from '../derive';

describe('computeBmi', () => {
  it('computes BMI rounded to one decimal (5\'10", 186.4 lb ≈ 84.55 kg)', () => {
    expect(computeBmi(177.8, 84.55)).toBe(26.7);
  });

  it('returns null when height is missing', () => {
    expect(computeBmi(null, 80)).toBeNull();
  });

  it('returns null when weight is missing', () => {
    expect(computeBmi(180, null)).toBeNull();
  });

  it('returns null for non-positive inputs', () => {
    expect(computeBmi(0, 80)).toBeNull();
    expect(computeBmi(180, 0)).toBeNull();
  });
});

describe('bmiCategory', () => {
  it('classifies the four bands at their boundaries', () => {
    expect(bmiCategory(18.4).key).toBe('underweight');
    expect(bmiCategory(18.5).key).toBe('normal');
    expect(bmiCategory(24.9).key).toBe('normal');
    expect(bmiCategory(25).key).toBe('overweight');
    expect(bmiCategory(29.9).key).toBe('overweight');
    expect(bmiCategory(30).key).toBe('obese');
  });

  it('exposes a human label', () => {
    expect(bmiCategory(26.7).label).toBe('Overweight');
  });
});

describe('weightDelta', () => {
  it('returns null with fewer than two entries', () => {
    expect(weightDelta([])).toBeNull();
    expect(weightDelta([{ weightKg: 90, recordedOn: '2026-03-03' }])).toBeNull();
  });

  it('computes delta (latest minus earliest) and week span, regardless of input order', () => {
    const result = weightDelta([
      { weightKg: 84.5, recordedOn: '2026-06-02' },
      { weightKg: 90.0, recordedOn: '2026-03-03' },
    ]);
    expect(result).not.toBeNull();
    expect(result!.deltaKg).toBe(-5.5);
    expect(result!.weeks).toBe(13);
  });
});
