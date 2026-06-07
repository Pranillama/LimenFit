'use client';

import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';

import type { MeasurementsDTO, MeasurementsPatchBody } from '@/lib/schemas/body-metrics';

export function useUpdateMeasurementsMutation() {
  return useMutation<MeasurementsDTO, Error, MeasurementsPatchBody>({
    mutationFn: async (patch) => {
      const res = await fetch('/api/measurements', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });

      if (!res.ok) {
        let message = `HTTP ${res.status}`;
        try {
          const json = (await res.json()) as { error?: { message?: string } };
          if (json.error?.message) message = json.error.message;
        } catch {
          // ignore parse errors
        }
        throw new Error(message);
      }

      return (await res.json()) as MeasurementsDTO;
    },
    onSuccess: () => {
      toast.success('Measurements saved');
    },
    onError: () => {
      toast.error('Failed to save measurements');
    },
  });
}
