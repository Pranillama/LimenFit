import { z } from 'zod';

import type { Database } from '@/lib/supabase/types';

type WeightUnit = Database['public']['Enums']['weight_unit'];

export const WEIGHT_UNITS = ['lbs', 'kg'] as const satisfies readonly [WeightUnit, ...WeightUnit[]];

export const userSettingsPatchBodySchema = z
  .object({
    weightUnit: z.enum(WEIGHT_UNITS).optional(),
    restTimerDefaultSeconds: z.number().int().min(0).max(600).optional(),
  })
  .refine((data) => data.weightUnit !== undefined || data.restTimerDefaultSeconds !== undefined, {
    message: 'At least one of weightUnit or restTimerDefaultSeconds must be provided',
  });

export type UserSettingsPatchBody = z.infer<typeof userSettingsPatchBodySchema>;

export type UserSettingsDTO = {
  weightUnit: WeightUnit;
  restTimerDefaultSeconds: number;
};
