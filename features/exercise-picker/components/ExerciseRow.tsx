'use client';

import * as React from 'react';
import { Check } from 'lucide-react';

import {
  EXERCISE_CATEGORY_OPTIONS,
  EXERCISE_EQUIPMENT_OPTIONS,
  type ExerciseCategory,
  type ExerciseEquipment,
} from '@/lib/exercises/catalog';
import { cn } from '@/lib/utils';

import type { ExerciseListItem, ExercisePreview } from '../types';

interface ExerciseRowProps {
  item: ExerciseListItem;
  selected: boolean;
  preview?: ExercisePreview;
  onToggle: () => void;
}

function categoryLabel(value: ExerciseCategory): string {
  return EXERCISE_CATEGORY_OPTIONS.find((o) => o.value === value)?.label ?? value;
}

function equipmentLabel(value: ExerciseEquipment): string {
  return EXERCISE_EQUIPMENT_OPTIONS.find((o) => o.value === value)?.label ?? value;
}

export function ExerciseRow({ item, selected, preview, onToggle }: ExerciseRowProps) {
  const metaParts = [categoryLabel(item.category)];
  if (item.equipment) metaParts.push(equipmentLabel(item.equipment));
  const meta = metaParts.join(' · ');

  const previewText = preview
    ? `${preview.lastWeightValue} ${preview.lastWeightUnit} × ${preview.lastReps}`
    : null;

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={selected}
      className={cn(
        'flex w-full items-center gap-3 rounded-md px-3 py-2 text-left hover:bg-accent',
        selected && 'bg-accent',
      )}
    >
      <span
        className={cn(
          'flex h-5 w-5 shrink-0 items-center justify-center rounded border',
          selected
            ? 'border-primary bg-primary text-primary-foreground'
            : 'border-muted-foreground/40',
        )}
      >
        {selected && <Check className="h-3.5 w-3.5" />}
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="block truncate text-sm font-medium">{item.name}</span>
          {item.isCustom && (
            <span className="shrink-0 text-xs text-muted-foreground">Custom</span>
          )}
        </span>
        <span className="block truncate text-xs text-muted-foreground">{meta}</span>
      </span>

      {previewText && (
        <span className="shrink-0 text-xs text-muted-foreground">{previewText}</span>
      )}
    </button>
  );
}
