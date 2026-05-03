'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { createSupabaseBrowserClient } from '@/lib/supabase/browser';
import type { Database } from '@/lib/supabase/types';
import type { ExerciseCategory, ExerciseEquipment } from '@/lib/exercises/catalog';
import type { ExerciseListItem } from '../types';

type ExerciseRow = Pick<
  Database['public']['Tables']['exercises']['Row'],
  'id' | 'name' | 'category' | 'equipment' | 'is_custom'
>;

export function useExercisesQuery() {
  const [supabase] = useState(() => createSupabaseBrowserClient());

  return useQuery<ExerciseListItem[]>({
    queryKey: ['exercises', 'library'],
    staleTime: 10 * 60_000,
    queryFn: async () => {
      const { data, error } = (await supabase
        .from('exercises')
        .select('id, name, category, equipment, is_custom')
        .order('name', { ascending: true })) as unknown as {
        data: ExerciseRow[] | null;
        error: Error | null;
      };

      if (error) throw error;

      return (data ?? []).map((row) => ({
        id: row.id,
        name: row.name,
        category: row.category as ExerciseCategory,
        equipment: row.equipment as ExerciseEquipment | null,
        isCustom: row.is_custom,
      }));
    },
  });
}
