import { describe, it, expect } from 'vitest';

import {
  computeBmi,
  bmiCategory,
  bmiRangeLabel,
  healthyWeightRange,
  idealWeight,
  ageFromDob,
  bmiToAngle,
  weightDelta,
} from '../derive';

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

  it('exposes the band bounds (max null for obese)', () => {
    expect(bmiCategory(17)).toMatchObject({ min: 0, max: 18.5 });
    expect(bmiCategory(22)).toMatchObject({ min: 18.5, max: 25 });
    expect(bmiCategory(27)).toMatchObject({ min: 25, max: 30 });
    expect(bmiCategory(32)).toMatchObject({ min: 30, max: null });
  });
});

describe('bmiRangeLabel', () => {
  it('formats each band for display', () => {
    expect(bmiRangeLabel(bmiCategory(17))).toBe('< 18.5');
    expect(bmiRangeLabel(bmiCategory(22))).toBe('18.5 – 24.9');
    expect(bmiRangeLabel(bmiCategory(27))).toBe('25 – 29.9');
    expect(bmiRangeLabel(bmiCategory(32))).toBe('30+');
  });
});

describe('healthyWeightRange', () => {
  it('computes the BMI 18.5–24.9 weight range for a height (177.8 cm)', () => {
    expect(healthyWeightRange(177.8)).toEqual({ minKg: 58.5, maxKg: 78.7 });
  });

  it('returns null for missing or non-positive height', () => {
    expect(healthyWeightRange(null)).toBeNull();
    expect(healthyWeightRange(0)).toBeNull();
  });
});

describe('idealWeight', () => {
  it('computes the BMI 22 midpoint weight for a height (177.8 cm)', () => {
    expect(idealWeight(177.8)).toBe(69.5);
  });

  it('returns null for missing or non-positive height', () => {
    expect(idealWeight(null)).toBeNull();
    expect(idealWeight(0)).toBeNull();
  });
});

describe('ageFromDob', () => {
  it('computes whole years as of a reference date', () => {
    expect(ageFromDob('1994-01-01', new Date('2026-06-07'))).toBe(32);
  });

  it('does not count a birthday that has not occurred yet this year', () => {
    expect(ageFromDob('1994-12-31', new Date('2026-06-07'))).toBe(31);
  });

  it('returns null for missing or invalid input', () => {
    expect(ageFromDob(null)).toBeNull();
    expect(ageFromDob('not-a-date')).toBeNull();
  });
});

describe('bmiToAngle', () => {
  it('maps the 16–40 BMI domain onto a 180°→0° arc', () => {
    expect(bmiToAngle(16)).toBe(180);
    expect(bmiToAngle(28)).toBe(90);
    expect(bmiToAngle(40)).toBe(0);
  });

  it('clamps out-of-range BMI to the arc ends', () => {
    expect(bmiToAngle(10)).toBe(180);
    expect(bmiToAngle(50)).toBe(0);
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
