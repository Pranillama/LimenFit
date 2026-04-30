import { z } from 'zod';

import type { Database } from '@/lib/supabase/types';

type WorkoutStatus = Database['public']['Enums']['workout_status'];

// Excludes 'expired' — that transition is cron-only and must not be settable by clients.
// satisfies ensures this array stays in sync if DB enum values are renamed.
const CLIENT_SETTABLE_STATUSES = ['in_progress', 'completed'] as const satisfies readonly [
  WorkoutStatus,
  ...WorkoutStatus[],
];

const uuid = z.string().uuid();
const iso = z.string().datetime();

export const workoutCreateBodySchema = z.object({
  clientMutationId: uuid,
  localId: uuid,
  name: z.string().nullable(),
  planWorkoutId: uuid.nullable(),
  originPlanWorkoutId: uuid.nullable(),
  startedAt: iso,
  lastActivityAt: iso,
});

export const workoutPatchBodySchema = z.object({
  clientMutationId: uuid,
  name: z.string().nullable().optional(),
  status: z.enum(CLIENT_SETTABLE_STATUSES).optional(),
  lastActivityAt: iso.optional(),
});

export const workoutDiscardBodySchema = z.object({
  clientMutationId: uuid,
});

export const workoutRestoreBodySchema = z.object({
  clientMutationId: uuid,
});

export type WorkoutCreateBody = z.infer<typeof workoutCreateBodySchema>;
export type WorkoutPatchBody = z.infer<typeof workoutPatchBodySchema>;
export type WorkoutDiscardBody = z.infer<typeof workoutDiscardBodySchema>;
export type WorkoutRestoreBody = z.infer<typeof workoutRestoreBodySchema>;
