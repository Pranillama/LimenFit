import { z } from 'zod';

import type { Database } from '@/lib/supabase/types';

type WeightUnit = Database['public']['Enums']['weight_unit'];

// satisfies ensures this tuple stays in sync if the DB enum values are renamed.
const WEIGHT_UNITS = ['lbs', 'kg'] as const satisfies readonly [WeightUnit, ...WeightUnit[]];

const uuid = z.string().uuid();
const iso = z.string().datetime();
const weightUnit = z.enum(WEIGHT_UNITS);

export const setLogBodySchema = z.object({
  clientMutationId: uuid,
  localId: uuid,
  workoutExerciseId: uuid,
  setNumber: z.number().int().min(1),
  reps: z.number().int().min(0),
  weightValue: z.number(),
  weightUnit,
  loggedAt: iso,
});

export const setEditBodySchema = z
  .object({
    clientMutationId: uuid,
    reps: z.number().int().min(0).optional(),
    weightValue: z.number().optional(),
    weightUnit: weightUnit.optional(),
  })
  .refine(
    (data) =>
      data.reps !== undefined || data.weightValue !== undefined || data.weightUnit !== undefined,
    { message: 'At least one of reps, weightValue, or weightUnit must be provided' },
  );

export const setDeleteBodySchema = z.object({
  clientMutationId: uuid,
});

export type SetLogBody = z.infer<typeof setLogBodySchema>;
export type SetEditBody = z.infer<typeof setEditBodySchema>;
export type SetDeleteBody = z.infer<typeof setDeleteBodySchema>;
