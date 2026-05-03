'use client';

import * as React from 'react';
import { ChevronDown, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  EXERCISE_CATEGORY_OPTIONS,
  EXERCISE_EQUIPMENT_OPTIONS,
  type ExerciseCategory,
  type ExerciseEquipment,
} from '@/lib/exercises/catalog';

import type { ExerciseFilters } from '../types';

interface FilterRowProps {
  filters: ExerciseFilters;
  onRemoveEquipment: (value: ExerciseEquipment) => void;
  onRemoveCategory: (value: ExerciseCategory) => void;
  onClearFilters: () => void;
  onOpenEquipmentSheet: () => void;
  onOpenCategorySheet: () => void;
}

function equipmentLabel(value: ExerciseEquipment): string {
  return EXERCISE_EQUIPMENT_OPTIONS.find((o) => o.value === value)?.label ?? value;
}

function categoryLabel(value: ExerciseCategory): string {
  return EXERCISE_CATEGORY_OPTIONS.find((o) => o.value === value)?.label ?? value;
}

export function FilterRow({
  filters,
  onRemoveEquipment,
  onRemoveCategory,
  onClearFilters,
  onOpenEquipmentSheet,
  onOpenCategorySheet,
}: FilterRowProps) {
  const hasFilters = filters.equipment.length > 0 || filters.categories.length > 0;

  return (
    <div className="flex flex-wrap items-center gap-2 px-4 pb-3">
      {filters.equipment.map((eq) => (
        <Chip key={eq} label={equipmentLabel(eq)} onRemove={() => onRemoveEquipment(eq)} />
      ))}
      {filters.categories.map((cat) => (
        <Chip key={cat} label={categoryLabel(cat)} onRemove={() => onRemoveCategory(cat)} />
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-8 text-xs"
        onClick={onOpenEquipmentSheet}
      >
        All Equipment
        <ChevronDown className="ml-1 h-3 w-3" />
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-8 text-xs"
        onClick={onOpenCategorySheet}
      >
        All Muscles
        <ChevronDown className="ml-1 h-3 w-3" />
      </Button>
      {hasFilters && (
        <button
          type="button"
          aria-label="Clear all filters"
          onClick={onClearFilters}
          className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-muted-foreground hover:bg-muted/80"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

function Chip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground">
      {label}
      <button
        type="button"
        aria-label={`Remove ${label}`}
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        className="-mr-0.5 rounded-full hover:bg-primary-foreground/20"
      >
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}
