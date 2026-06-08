import { z } from 'zod';

export const bodyweightLogBodySchema = z.object({
  weightKg: z.number().positive().max(500),
});
export type BodyweightLogBody = z.infer<typeof bodyweightLogBodySchema>;

export type BodyweightEntryDTO = {
  id: string;
  weightKg: number;
  recordedOn: string; // YYYY-MM-DD
};

const lengthValue = z.number().positive().max(500).nullable();

export const measurementsPatchBodySchema = z
  .object({
    bodyFatPct: z.number().min(0).max(100).nullable().optional(),
    waistCm: lengthValue.optional(),
    chestCm: lengthValue.optional(),
    armsCm: lengthValue.optional(),
    legsCm: lengthValue.optional(),
  })
  .refine((d) => Object.keys(d).length > 0, {
    message: 'At least one measurement must be provided',
  });
export type MeasurementsPatchBody = z.infer<typeof measurementsPatchBodySchema>;

export type MeasurementsDTO = {
  bodyFatPct: number | null;
  waistCm: number | null;
  chestCm: number | null;
  armsCm: number | null;
  legsCm: number | null;
  recordedOn: string | null;
};
