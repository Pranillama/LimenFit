import { z } from 'zod';

import type { Database } from '@/lib/supabase/types';

type FitnessGoal = Database['public']['Enums']['fitness_goal'];
type ActivityLevel = Database['public']['Enums']['activity_level'];
type TrainingExperience = Database['public']['Enums']['training_experience'];
type Gender = Database['public']['Enums']['gender'];

export const FITNESS_GOALS = [
  'fat_loss',
  'muscle_gain',
  'strength',
  'endurance',
  'general_fitness',
] as const satisfies readonly [FitnessGoal, ...FitnessGoal[]];

export const ACTIVITY_LEVELS = [
  'sedentary',
  'lightly_active',
  'moderately_active',
  'very_active',
] as const satisfies readonly [ActivityLevel, ...ActivityLevel[]];

export const TRAINING_EXPERIENCES = [
  'beginner',
  'intermediate',
  'advanced',
] as const satisfies readonly [TrainingExperience, ...TrainingExperience[]];

export const GENDERS = [
  'male',
  'female',
  'prefer_not_to_say',
] as const satisfies readonly [Gender, ...Gender[]];

const nullableTrimmedText = z
  .string()
  .trim()
  .max(120)
  .nullable()
  .or(z.string().trim().max(120).transform((v) => (v.length === 0 ? null : v)));

export const profilePatchBodySchema = z
  .object({
    firstName: nullableTrimmedText.optional(),
    lastName: nullableTrimmedText.optional(),
    displayName: nullableTrimmedText.optional(),
    username: z.string().trim().min(2).max(32).regex(/^[a-z0-9_.-]+$/i).nullable().optional(),
    avatarUrl: z.string().url().max(2048).nullable().optional(),
    dateOfBirth: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .nullable()
      .optional(),
    gender: z.enum(GENDERS).nullable().optional(),
    heightCm: z.number().positive().max(300).nullable().optional(),
    startingWeightKg: z.number().positive().max(500).nullable().optional(),
    timeZone: z.string().max(64).nullable().optional(),
    primaryGoal: z.enum(FITNESS_GOALS).nullable().optional(),
    goalWeightKg: z.number().positive().max(500).nullable().optional(),
    targetDailyCalories: z.number().int().positive().max(20000).nullable().optional(),
    activityLevel: z.enum(ACTIVITY_LEVELS).nullable().optional(),
    trainingExperience: z.enum(TRAINING_EXPERIENCES).nullable().optional(),
    weeklyTrainingFrequency: z.number().int().min(2).max(6).nullable().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Patch must contain at least one field',
  });

export type ProfilePatchBody = z.infer<typeof profilePatchBodySchema>;

export type ProfileDTO = {
  firstName: string | null;
  lastName: string | null;
  displayName: string | null;
  username: string | null;
  avatarUrl: string | null;
  dateOfBirth: string | null;
  gender: Gender | null;
  heightCm: number | null;
  startingWeightKg: number | null;
  timeZone: string | null;
  primaryGoal: FitnessGoal | null;
  goalWeightKg: number | null;
  targetDailyCalories: number | null;
  activityLevel: ActivityLevel | null;
  trainingExperience: TrainingExperience | null;
  weeklyTrainingFrequency: number | null;
};
