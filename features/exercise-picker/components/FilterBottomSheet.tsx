'use client';

import * as React from 'react';
import { Check } from 'lucide-react';

import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import {
  EXERCISE_EQUIPMENT_OPTIONS,
  EXERCISE_CATEGORY_OPTIONS,
} from '@/lib/exercises/catalog';

interface FilterBottomSheetProps {
  kind: 'equipment' | 'category';
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selected: string[];
  onToggle: (value: string) => void;
}

export function FilterBottomSheet({
  kind,
  open,
  onOpenChange,
  selected,
  onToggle,
}: FilterBottomSheetProps) {
  const options =
    kind === 'equipment' ? EXERCISE_EQUIPMENT_OPTIONS : EXERCISE_CATEGORY_OPTIONS;
  const title = kind === 'equipment' ? 'Equipment' : 'Muscle Group';

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" hideDefaultClose className="rounded-t-2xl px-0 pb-8">
        <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-muted-foreground/30" />
        <SheetTitle className="mt-3 text-center text-base font-semibold">{title}</SheetTitle>
        <ul className="mt-3 divide-y divide-border">
          {options.map(({ value, label }) => {
            const isSelected = selected.includes(value);
            return (
              <li key={value}>
                <button
                  type="button"
                  className="flex w-full items-center justify-between px-5 py-3 text-sm hover:bg-accent"
                  onClick={() => onToggle(value)}
                >
                  <span>{label}</span>
                  {isSelected && <Check className="h-4 w-4 text-primary" />}
                </button>
              </li>
            );
          })}
        </ul>
      </SheetContent>
    </Sheet>
  );
}
