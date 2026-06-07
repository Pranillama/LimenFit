export type BmiCategoryKey = 'underweight' | 'normal' | 'overweight' | 'obese';

export type BmiCategory = {
  key: BmiCategoryKey;
  label: string;
  /** Lower BMI bound of the band (0 for underweight). */
  min: number;
  /** Upper BMI bound of the band, or null for the open-ended obese band. */
  max: number | null;
};

/** BMI = kg / m^2, rounded to one decimal. Null when inputs are missing or non-positive. */
export function computeBmi(heightCm: number | null, weightKg: number | null): number | null {
  if (heightCm === null || weightKg === null) return null;
  if (heightCm <= 0 || weightKg <= 0) return null;
  const m = heightCm / 100;
  return Math.round((weightKg / (m * m)) * 10) / 10;
}

export function bmiCategory(bmi: number): BmiCategory {
  if (bmi < 18.5) return { key: 'underweight', label: 'Underweight', min: 0, max: 18.5 };
  if (bmi < 25) return { key: 'normal', label: 'Normal', min: 18.5, max: 25 };
  if (bmi < 30) return { key: 'overweight', label: 'Overweight', min: 25, max: 30 };
  return { key: 'obese', label: 'Obese', min: 30, max: null };
}

/** Display label for a band's BMI range, e.g. "18.5 – 24.9", "< 18.5", "30+". */
export function bmiRangeLabel(category: BmiCategory): string {
  if (category.min === 0 && category.max !== null) return `< ${category.max}`;
  if (category.max === null) return `${category.min}+`;
  const upper = Math.round((category.max - 0.1) * 10) / 10;
  return `${category.min} – ${upper}`;
}

export type HealthyWeightRange = { minKg: number; maxKg: number };

/** Weight range (kg) spanning BMI 18.5–24.9 for a given height. Null when height is missing. */
export function healthyWeightRange(heightCm: number | null): HealthyWeightRange | null {
  if (heightCm === null || heightCm <= 0) return null;
  const m = heightCm / 100;
  return {
    minKg: Math.round(18.5 * m * m * 10) / 10,
    maxKg: Math.round(24.9 * m * m * 10) / 10,
  };
}

/** "Ideal" weight (kg) at the BMI 22 midpoint of the healthy range. Null when height is missing. */
export function idealWeight(heightCm: number | null): number | null {
  if (heightCm === null || heightCm <= 0) return null;
  const m = heightCm / 100;
  return Math.round(22 * m * m * 10) / 10;
}

/** Whole years between a YYYY-MM-DD birth date and `now`. Null for missing/invalid input. */
export function ageFromDob(dob: string | null, now: Date = new Date()): number | null {
  if (!dob) return null;
  const birth = new Date(dob);
  if (isNaN(birth.getTime())) return null;
  let age = now.getFullYear() - birth.getFullYear();
  const monthDelta = now.getMonth() - birth.getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && now.getDate() < birth.getDate())) age--;
  return age >= 0 ? age : null;
}

/** BMI domain for the gauge arc. */
export const GAUGE_BMI_MIN = 16;
export const GAUGE_BMI_MAX = 40;

/**
 * Maps a BMI onto the gauge's polar angle in degrees: 180° at the left end
 * (BMI 16), 90° at the top (BMI 28), 0° at the right end (BMI 40). Out-of-range
 * values clamp to the ends. Used for both the needle and the band-arc boundaries.
 */
export function bmiToAngle(bmi: number): number {
  const t = Math.min(1, Math.max(0, (bmi - GAUGE_BMI_MIN) / (GAUGE_BMI_MAX - GAUGE_BMI_MIN)));
  return 180 - t * 180;
}

export type WeightDelta = { deltaKg: number; weeks: number };

/**
 * Delta from the earliest to the latest entry. Entries may be unsorted; we sort
 * by recordedOn ascending. Returns null with fewer than two entries.
 */
export function weightDelta(
  entries: Array<{ weightKg: number; recordedOn: string }>,
): WeightDelta | null {
  if (entries.length < 2) return null;
  const sorted = [...entries].sort((a, b) => a.recordedOn.localeCompare(b.recordedOn));
  const first = sorted[0]!;
  const last = sorted[sorted.length - 1]!;
  const deltaKg = Math.round((last.weightKg - first.weightKg) * 10) / 10;
  const ms = new Date(last.recordedOn).getTime() - new Date(first.recordedOn).getTime();
  const weeks = Math.max(1, Math.round(ms / (7 * 24 * 60 * 60 * 1000)));
  return { deltaKg, weeks };
}
