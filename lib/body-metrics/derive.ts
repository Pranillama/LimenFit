export type BmiCategoryKey = 'underweight' | 'normal' | 'overweight' | 'obese';

export type BmiCategory = {
  key: BmiCategoryKey;
  label: string;
};

/** BMI = kg / m^2, rounded to one decimal. Null when inputs are missing or non-positive. */
export function computeBmi(heightCm: number | null, weightKg: number | null): number | null {
  if (heightCm === null || weightKg === null) return null;
  if (heightCm <= 0 || weightKg <= 0) return null;
  const m = heightCm / 100;
  return Math.round((weightKg / (m * m)) * 10) / 10;
}

export function bmiCategory(bmi: number): BmiCategory {
  if (bmi < 18.5) return { key: 'underweight', label: 'Underweight' };
  if (bmi < 25) return { key: 'normal', label: 'Normal' };
  if (bmi < 30) return { key: 'overweight', label: 'Overweight' };
  return { key: 'obese', label: 'Obese' };
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
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const first = sorted[0]!;
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const last = sorted[sorted.length - 1]!;
  const deltaKg = Math.round((last.weightKg - first.weightKg) * 10) / 10;
  const ms = new Date(last.recordedOn).getTime() - new Date(first.recordedOn).getTime();
  const weeks = Math.max(1, Math.round(ms / (7 * 24 * 60 * 60 * 1000)));
  return { deltaKg, weeks };
}
