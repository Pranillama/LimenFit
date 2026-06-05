import { z } from 'zod';

import type { Database } from '@/lib/supabase/types';

type WeightUnit = Database['public']['Enums']['weight_unit'];
type HeightUnit = Database['public']['Enums']['height_unit'];

export const WEIGHT_UNITS = ['lbs', 'kg'] as const satisfies readonly [WeightUnit, ...WeightUnit[]];
export const HEIGHT_UNITS = ['ft', 'cm'] as const satisfies readonly [HeightUnit, ...HeightUnit[]];

export const userSettingsPatchBodySchema = z
  .object({
    weightUnit: z.enum(WEIGHT_UNITS).optional(),
    heightUnit: z.enum(HEIGHT_UNITS).optional(),
    restTimerDefaultSeconds: z.number().int().min(0).max(600).optional(),
  })
  .refine(
    (data) =>
      data.weightUnit !== undefined ||
      data.heightUnit !== undefined ||
      data.restTimerDefaultSeconds !== undefined,
    { message: 'At least one field must be provided' },
  );

export type UserSettingsPatchBody = z.infer<typeof userSettingsPatchBodySchema>;

export type UserSettingsDTO = {
  weightUnit: WeightUnit;
  heightUnit: HeightUnit;
  restTimerDefaultSeconds: number;
};
