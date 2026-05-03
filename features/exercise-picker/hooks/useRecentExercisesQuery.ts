'use client';

import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { createSupabaseBrowserClient } from '@/lib/supabase/browser';
import type { Database } from '@/lib/supabase/types';

import type { ExercisePreview } from '../types';

type WorkoutExerciseRow = {
  id: string;
  exercise_id: string;
};

type SetRow = Pick<
  Database['public']['Tables']['sets']['Row'],
  'workout_exercise_id' | 'weight_value' | 'weight_unit' | 'reps' | 'logged_at'
>;

type RecentData = {
  recentIds: string[];
  previews: Map<string, ExercisePreview>;
};

// Returns undefined while loading, null when no authenticated user, or the user's ID.
function useSessionUserId(): string | null | undefined {
  const [supabase] = useState(() => createSupabaseBrowserClient());
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery<string | null>({
    queryKey: ['session', 'userId'],
    staleTime: Infinity,
    queryFn: async () => {
      const { data } = await supabase.auth.getUser();
      return data.user?.id ?? null;
    },
  });

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const nextUserId = session?.user?.id ?? null;
      const prevUserId = queryClient.getQueryData<string | null>(['session', 'userId']);

      if (nextUserId !== prevUserId) {
        queryClient.setQueryData(['session', 'userId'], nextUserId);
        if (prevUserId) {
          queryClient.removeQueries({ queryKey: ['exercises', 'recent', prevUserId] });
        }
      }
    });

    return () => subscription.unsubscribe();
  }, [supabase, queryClient]);

  if (isLoading) return undefined;
  return data ?? null;
}

export function useRecentExercisesQuery() {
  const userId = useSessionUserId();
  const [supabase] = useState(() => createSupabaseBrowserClient());

  return useQuery<RecentData>({
    queryKey: ['exercises', 'recent', userId],
    // undefined = still loading; null = no authenticated user — skip in both cases
    enabled: userId != null,
    staleTime: 60_000,
    queryFn: async () => {
      if (!userId) return { recentIds: [], previews: new Map() };

      // Step 1: Fetch recent workout_exercise rows ordered by workout recency.
      // Over-fetch 50 rows so we can deduplicate to the first 10 unique exercises.
      const { data: weRows, error: weError } = (await supabase
        .from('workout_exercises')
        .select('id, exercise_id, workouts!inner(user_id, last_activity_at, status)')
        .eq('workouts.user_id', userId)
        .in('workouts.status', ['in_progress', 'completed'])
        .order('last_activity_at', { referencedTable: 'workouts', ascending: false })
        .limit(50)) as unknown as {
        data: WorkoutExerciseRow[] | null;
        error: Error | null;
      };

      if (weError) throw weError;
      if (!weRows || weRows.length === 0) return { recentIds: [], previews: new Map() };

      // Map workout_exercise_id → exercise_id for all fetched rows (used in step 2).
      const weToExercise = new Map<string, string>();
      for (const row of weRows) {
        weToExercise.set(row.id, row.exercise_id);
      }

      // Reduce to first 10 unique exercise_ids preserving recency order.
      const recentIds: string[] = [];
      const seenExercises = new Set<string>();
      for (const row of weRows) {
        if (seenExercises.has(row.exercise_id)) continue;
        seenExercises.add(row.exercise_id);
        recentIds.push(row.exercise_id);
        if (recentIds.length >= 10) break;
      }

      if (recentIds.length === 0) return { recentIds: [], previews: new Map() };

      // Step 2: Get the latest set for each exercise across all fetched workout_exercise rows.
      const workoutExerciseIds = Array.from(weToExercise.keys());

      const { data: setsRows, error: setsError } = (await supabase
        .from('sets')
        .select('workout_exercise_id, weight_value, weight_unit, reps, logged_at')
        .in('workout_exercise_id', workoutExerciseIds)
        .order('logged_at', { ascending: false })) as unknown as {
        data: SetRow[] | null;
        error: Error | null;
      };

      if (setsError) throw setsError;

      // Reduce to the first (latest) set per exercise_id.
      const previews = new Map<string, ExercisePreview>();
      for (const set of setsRows ?? []) {
        const exerciseId = weToExercise.get(set.workout_exercise_id);
        if (!exerciseId || previews.has(exerciseId)) continue;
        previews.set(exerciseId, {
          exerciseId,
          lastWeightValue: set.weight_value,
          lastWeightUnit: set.weight_unit as 'lbs' | 'kg',
          lastReps: set.reps,
          lastLoggedAt: set.logged_at,
        });
      }

      return { recentIds, previews };
    },
  });
}
