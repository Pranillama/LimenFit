/**
 * Single source of truth for exercise category and equipment enumerations.
 * Shared by the API validation schema, the filter UI, and the custom-exercise
 * create dialog. Any change to seed.sql category/equipment values must be
 * mirrored here so the Zod enums stay in sync with the database.
 */

export const EXERCISE_CATEGORIES = [
  'chest',
  'back',
  'lats',
  'shoulders',
  'arms',
  'forearms',
  'legs',
  'hamstrings',
  'glutes',
  'calves',
  'core',
  'full_body',
  'cardio', // custom-only; no global seed rows, but valid in filter sheet and create dialog
] as const;

export const EXERCISE_EQUIPMENT = [
  'barbell',
  'dumbbell',
  'cable',
  'bodyweight',
  'machine',
  'kettlebell',
] as const;

export type ExerciseCategory = (typeof EXERCISE_CATEGORIES)[number];
export type ExerciseEquipment = (typeof EXERCISE_EQUIPMENT)[number];

export const EXERCISE_CATEGORY_OPTIONS: { value: ExerciseCategory; label: string }[] = [
  { value: 'chest', label: 'Chest' },
  { value: 'back', label: 'Back' },
  { value: 'lats', label: 'Lats' },
  { value: 'shoulders', label: 'Shoulders' },
  { value: 'arms', label: 'Arms' },
  { value: 'forearms', label: 'Forearms' },
  { value: 'legs', label: 'Legs' },
  { value: 'hamstrings', label: 'Hamstrings' },
  { value: 'glutes', label: 'Glutes' },
  { value: 'calves', label: 'Calves' },
  { value: 'core', label: 'Core' },
  { value: 'full_body', label: 'Full Body' },
  { value: 'cardio', label: 'Cardio' },
];

export const EXERCISE_EQUIPMENT_OPTIONS: { value: ExerciseEquipment; label: string }[] = [
  { value: 'barbell', label: 'Barbell' },
  { value: 'dumbbell', label: 'Dumbbell' },
  { value: 'cable', label: 'Cable' },
  { value: 'bodyweight', label: 'Bodyweight' },
  { value: 'machine', label: 'Machine' },
  { value: 'kettlebell', label: 'Kettlebell' },
];
