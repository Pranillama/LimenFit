import type { ExerciseCategory, ExerciseEquipment } from '@/lib/exercises/catalog';

export type ExerciseListItem = {
  id: string;
  name: string;
  category: ExerciseCategory;
  equipment: ExerciseEquipment | null;
  isCustom: boolean;
};

export type ExercisePreview = {
  exerciseId: string;
  lastWeightValue: number;
  lastWeightUnit: 'lbs' | 'kg';
  lastReps: number;
  lastLoggedAt: string;
} | null;

export type ExerciseFilters = {
  equipment: ExerciseEquipment[];
  categories: ExerciseCategory[];
};

export type ExercisePickerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (exerciseIds: string[]) => void;
  title?: string;
};
