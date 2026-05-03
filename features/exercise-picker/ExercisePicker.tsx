'use client';

import * as React from 'react';

import { DiscardConfirmationDialog } from '@/components/discard-confirmation-dialog';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import type { ExerciseCategory, ExerciseEquipment } from '@/lib/exercises/catalog';

import { AddCustomExerciseRow } from './components/AddCustomExerciseRow';
import { ExerciseList } from './components/ExerciseList';
import { FilterBottomSheet } from './components/FilterBottomSheet';
import { FilterRow } from './components/FilterRow';
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
    addEquipment,
    removeEquipment,
    addCategory,
    removeCategory,
    clearFilters,
    reset,
  } = usePickerSelection(open);

  const [filterSheetKind, setFilterSheetKind] = React.useState<'equipment' | 'category' | null>(
    null,
  );
  // Phase 6 will add CustomExerciseDialog state here.

  // Compute whether the AddCustomExerciseRow should be shown.
  // useExercisesQuery is also called inside ExerciseList; React Query deduplicates requests.
  const {
    data: exercises = [],
    isLoading: loadingExercises,
    isError: exercisesError,
  } = useExercisesQuery();
  const filtered = filterExercises(exercises, query, filters);
  const showAddCustom =
    query.trim().length > 0 && !loadingExercises && !exercisesError && filtered.length === 0;

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

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  function handleAddCustom(_name: string, _equipment?: ExerciseEquipment) {
    // Phase 6: open CustomExerciseDialog with name + equipment prefilled
  }

  function handleFilterToggle(value: string) {
    if (filterSheetKind === 'equipment') {
      const eq = value as ExerciseEquipment;
      if (filters.equipment.includes(eq)) {
        removeEquipment(eq);
      } else {
        addEquipment(eq);
      }
    } else if (filterSheetKind === 'category') {
      const cat = value as ExerciseCategory;
      if (filters.categories.includes(cat)) {
        removeCategory(cat);
      } else {
        addCategory(cat);
      }
    }
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
          <div className="border-b bg-background">
            <PickerHeader
              title={title}
              selectedCount={selectedIds.size}
              query={query}
              onQueryChange={setQuery}
              onClose={attemptClose}
              onConfirm={handleConfirm}
            />
            <FilterRow
              filters={filters}
              onRemoveEquipment={removeEquipment}
              onRemoveCategory={removeCategory}
              onClearFilters={clearFilters}
              onOpenEquipmentSheet={() => setFilterSheetKind('equipment')}
              onOpenCategorySheet={() => setFilterSheetKind('category')}
            />
          </div>
          <main className="flex-1 overflow-y-auto">
            <ExerciseList
              query={query}
              filters={filters}
              selectedIds={selectedIds}
              onToggle={toggleExercise}
            />
            {showAddCustom && (
              <AddCustomExerciseRow
                query={query}
                firstEquipment={filters.equipment[0]}
                onAdd={handleAddCustom}
              />
            )}
          </main>
        </SheetContent>
      </Sheet>

      {/* FilterBottomSheet lives as a sibling (not nested inside SheetContent) so
          Radix's dismissable-layer stack keeps Esc/overlay-click scoped to the inner sheet. */}
      <FilterBottomSheet
        kind={filterSheetKind ?? 'equipment'}
        open={filterSheetKind !== null}
        onOpenChange={(isOpen) => {
          if (!isOpen) setFilterSheetKind(null);
        }}
        selected={
          filterSheetKind === 'equipment'
            ? filters.equipment
            : filterSheetKind === 'category'
              ? filters.categories
              : []
        }
        onToggle={handleFilterToggle}
      />

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
