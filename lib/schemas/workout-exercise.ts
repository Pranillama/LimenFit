import { z } from 'zod';

const uuid = z.string().uuid();

export const workoutExerciseAddBodySchema = z.object({
  clientMutationId: uuid,
  localId: uuid,
  workoutId: uuid,
  exerciseId: uuid,
  position: z.number().int().min(0),
});

export const workoutExerciseReorderBodySchema = z.object({
  clientMutationId: uuid,
  position: z.number().int().min(0),
});

export const workoutExerciseDeleteBodySchema = z.object({
  clientMutationId: uuid,
});

export type WorkoutExerciseAddBody = z.infer<typeof workoutExerciseAddBodySchema>;
export type WorkoutExerciseReorderBody = z.infer<typeof workoutExerciseReorderBodySchema>;
export type WorkoutExerciseDeleteBody = z.infer<typeof workoutExerciseDeleteBodySchema>;
