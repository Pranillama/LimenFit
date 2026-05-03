'use client';

import * as React from 'react';

import { DiscardConfirmationDialog } from '@/components/discard-confirmation-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Sheet, SheetContent } from '@/components/ui/sheet';

import { PickerHeader } from './components/PickerHeader';
import { useExercisesQuery } from './hooks/useExercisesQuery';
import { usePickerSelection } from './hooks/usePickerSelection';
import { filterExercises } from './lib/filterAndSort';
import type { ExercisePickerProps } from './types';

export function ExercisePicker({
  open,
  onOpenChange,
  onConfirm,
  title = 'Select Exercises',
}: ExercisePickerProps) {
  const {
    selectedIds,
    query,
    setQuery,
    filters,
    showDiscardDialog,
    setShowDiscardDialog,
    toggleExercise,
    reset,
  } = usePickerSelection(open);

  const { data: exercises = [], isLoading } = useExercisesQuery();
  const filtered = filterExercises(exercises, query, filters);

  function attemptClose() {
    if (selectedIds.size > 0) {
      setShowDiscardDialog(true);
    } else {
      onOpenChange(false);
    }
  }

  function handleConfirm() {
    onConfirm(Array.from(selectedIds));
    reset();
    onOpenChange(false);
  }

  function handleDiscard() {
    reset();
    onOpenChange(false);
  }

  return (
    <>
      <Sheet
        open={open}
        onOpenChange={(wantsOpen) => {
          if (!wantsOpen) attemptClose();
        }}
      >
        <SheetContent
          hideDefaultClose
          side="bottom"
          className="flex h-[100dvh] max-h-[100dvh] w-full max-w-full flex-col rounded-none border-0 p-0 sm:max-w-md sm:rounded-l-lg"
        >
          <PickerHeader
            title={title}
            selectedCount={selectedIds.size}
            query={query}
            onQueryChange={setQuery}
            onClose={attemptClose}
            onConfirm={handleConfirm}
          />
          <main className="flex-1 overflow-y-auto py-2">
            {isLoading ? (
              <ul className="space-y-1 px-3">
                {Array.from({ length: 8 }).map((_, i) => (
                  <li key={i}>
                    <Skeleton className="h-10 w-full rounded-md" />
                  </li>
                ))}
              </ul>
            ) : filtered.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No exercises found.</p>
            ) : (
              <ul className="space-y-1 px-3">
                {filtered.map((exercise) => (
                  <li key={exercise.id}>
                    <button
                      type="button"
                      onClick={() => toggleExercise(exercise.id)}
                      className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm hover:bg-accent data-[selected=true]:bg-accent"
                      data-selected={selectedIds.has(exercise.id)}
                    >
                      <span className={selectedIds.has(exercise.id) ? 'font-medium' : undefined}>
                        {exercise.name}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </main>
        </SheetContent>
      </Sheet>
      <DiscardConfirmationDialog
        open={showDiscardDialog}
        onOpenChange={setShowDiscardDialog}
        title="Discard selection?"
        description="You'll lose the exercises you've selected."
        onDiscard={handleDiscard}
      />
    </>
  );
}
