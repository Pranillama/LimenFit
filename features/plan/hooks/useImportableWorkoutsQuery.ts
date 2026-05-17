'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { createSupabaseBrowserClient } from '@/lib/supabase/browser';

export interface ImportableWorkout {
  id: string;
  name: string | null;
  started_at: string;
  workout_exercises: Array<{
    id: string;
    exercise_id: string;
    position: number;
    sets: Array<{ set_number: number; reps: number | null }>;
  }>;
}

export function useImportableWorkoutsQuery() {
  const [supabase] = useState(() => createSupabaseBrowserClient());

  return useQuery<ImportableWorkout[]>({
    queryKey: ['plans', 'importable-workouts'],
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = (await supabase
        .from('workouts')
        .select(
          'id, name, started_at, workout_exercises(id, exercise_id, position, sets(set_number, reps))',
        )
        .eq('status', 'completed')
        .order('started_at', { ascending: false })
        .limit(50)) as unknown as {
        data: ImportableWorkout[] | null;
        error: Error | null;
      };

      if (error) throw error;
      return data ?? [];
    },
  });
}
