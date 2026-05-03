'use client';

import * as React from 'react';

import { Skeleton } from '@/components/ui/skeleton';

import { useExercisesQuery } from '../hooks/useExercisesQuery';
import { useRecentExercisesQuery } from '../hooks/useRecentExercisesQuery';
import { filterExercises, splitRecentVsAll } from '../lib/filterAndSort';
import type { ExerciseFilters } from '../types';
import { ExerciseRow } from './ExerciseRow';

interface ExerciseListProps {
  query: string;
  filters: ExerciseFilters;
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
}

export function ExerciseList({ query, filters, selectedIds, onToggle }: ExerciseListProps) {
  const {
    data: exercises = [],
    isLoading: loadingExercises,
    error: exercisesError,
    refetch,
  } = useExercisesQuery();
  const { data: recentData, isLoading: loadingRecent } = useRecentExercisesQuery();

  if (loadingExercises || loadingRecent) {
    return (
      <ul className="space-y-1 px-3 py-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <li key={i}>
            <Skeleton className="h-12 w-full rounded-md" />
          </li>
        ))}
      </ul>
    );
  }

  if (exercisesError) {
    return (
      <div className="py-8 text-center">
        <p className="text-sm text-muted-foreground">Failed to load exercises.</p>
        <button
          type="button"
          onClick={() => refetch()}
          className="mt-2 text-sm text-primary underline"
        >
          Retry
        </button>
      </div>
    );
  }

  const filtered = filterExercises(exercises, query, filters);
  const recentIds = recentData?.recentIds ?? [];
  const previews = recentData?.previews ?? new Map();
  const isSearching = query.trim().length > 0;
  const { recent, all } = splitRecentVsAll(filtered, recentIds);
  const allSectionItems = isSearching ? filtered : all;

  return (
    <div className="py-2">
      {!isSearching && recent.length > 0 && (
        <section>
          <SectionHeader label="RECENT" />
          <ul className="space-y-1 px-3">
            {recent.map((item) => (
              <li key={item.id}>
                <ExerciseRow
                  item={item}
                  selected={selectedIds.has(item.id)}
                  preview={previews.get(item.id) ?? undefined}
                  onToggle={() => onToggle(item.id)}
                />
              </li>
            ))}
          </ul>
        </section>
      )}
      {allSectionItems.length > 0 && (
        <section className={!isSearching && recent.length > 0 ? 'mt-4' : undefined}>
          <SectionHeader label="ALL EXERCISES" />
          <ul className="space-y-1 px-3">
            {allSectionItems.map((item) => (
              <li key={item.id}>
                <ExerciseRow
                  item={item}
                  selected={selectedIds.has(item.id)}
                  preview={previews.get(item.id) ?? undefined}
                  onToggle={() => onToggle(item.id)}
                />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function SectionHeader({ label }: { label: string }) {
  return (
    <h3 className="px-4 pb-1 pt-2 text-xs font-semibold tracking-wider text-muted-foreground">
      {label}
    </h3>
  );
}
