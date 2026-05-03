'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { toast } from '@/components/ui/sonner';
import { newClientMutationId } from '@/lib/idempotency';
import type { ExerciseCategory, ExerciseEquipment } from '@/lib/exercises/catalog';

import type { ExerciseListItem } from '../types';

type CreateExerciseInput = {
  name: string;
  category: ExerciseCategory;
  equipment?: ExerciseEquipment | null;
};

type CreateExerciseResponse = {
  id: string;
  clientMutationId: string;
  name: string;
  category: ExerciseCategory;
  equipment: ExerciseEquipment | null;
  isCustom: boolean;
};

export function useCreateExerciseMutation() {
  const queryClient = useQueryClient();

  return useMutation<ExerciseListItem, Error, CreateExerciseInput>({
    mutationFn: async (input) => {
      const clientMutationId = newClientMutationId();

      const response = await fetch('/api/exercises', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': clientMutationId,
        },
        body: JSON.stringify({
          clientMutationId,
          name: input.name,
          category: input.category,
          equipment: input.equipment ?? null,
        }),
      });

      if (!response.ok) {
        let message = `HTTP ${response.status}`;
        try {
          const body = (await response.json()) as { error?: { message?: string } };
          if (body.error?.message) message = body.error.message;
        } catch {
          // ignore parse errors
        }
        throw new Error(message);
      }

      const data = (await response.json()) as CreateExerciseResponse;

      return {
        id: data.id,
        name: data.name,
        category: data.category,
        equipment: data.equipment,
        isCustom: data.isCustom,
      };
    },
    onSuccess: (newExercise) => {
      // Optimistically prepend so the exercise appears in the picker immediately.
      queryClient.setQueryData<ExerciseListItem[]>(['exercises', 'library'], (old) =>
        old ? [newExercise, ...old] : [newExercise],
      );
      // Invalidate to trigger a refetch that restores alphabetical order.
      void queryClient.invalidateQueries({ queryKey: ['exercises'] });
    },
    onError: () => {
      toast.error('Failed to create exercise. Please try again.');
    },
  });
}
