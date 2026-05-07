import { z } from 'zod';

const uuid = z.string().uuid();

export const planExerciseDraftSchema = z.object({
  exerciseId: uuid,
  targetSets: z.number().int().min(1).max(50),
  targetReps: z.number().int().min(0).max(1000),
  position: z.number().int().min(0),
});

export const planWorkoutDraftSchema = z.object({
  name: z.string().trim().min(1).max(100),
  position: z.number().int().min(0),
  exercises: z.array(planExerciseDraftSchema).min(1).max(50),
});

export const planCreateBodySchema = z.object({
  clientMutationId: uuid,
  name: z.string().trim().min(1).max(100),
  workouts: z.array(planWorkoutDraftSchema).min(1).max(20),
});

export const planPatchBodySchema = z
  .object({
    clientMutationId: uuid,
    name: z.string().trim().min(1).max(100).optional(),
    workouts: z.array(planWorkoutDraftSchema).min(1).max(20).optional(),
  })
  .refine(
    (data) => data.name !== undefined || data.workouts !== undefined,
    { message: 'At least one of name or workouts must be provided' },
  );

export const planDeleteBodySchema = z.object({
  clientMutationId: uuid,
});

export type PlanExerciseDraft = z.infer<typeof planExerciseDraftSchema>;
export type PlanWorkoutDraft = z.infer<typeof planWorkoutDraftSchema>;
export type PlanCreateBody = z.infer<typeof planCreateBodySchema>;
export type PlanPatchBody = z.infer<typeof planPatchBodySchema>;
export type PlanDeleteBody = z.infer<typeof planDeleteBodySchema>;
