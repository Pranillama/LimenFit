import { z } from 'zod';

import { EXERCISE_CATEGORIES, EXERCISE_EQUIPMENT } from '@/lib/exercises/catalog';

const uuid = z.string().uuid();

export const exerciseCreateBodySchema = z.object({
  clientMutationId: uuid,
  name: z.string().trim().min(1).max(100),
  category: z.enum(EXERCISE_CATEGORIES),
  equipment: z.enum(EXERCISE_EQUIPMENT).nullable().optional().default(null),
});

export type ExerciseCreateBody = z.infer<typeof exerciseCreateBodySchema>;
