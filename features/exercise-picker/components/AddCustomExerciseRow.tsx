'use client';

import * as React from 'react';
import { Plus } from 'lucide-react';

import type { ExerciseEquipment } from '@/lib/exercises/catalog';

interface AddCustomExerciseRowProps {
  query: string;
  firstEquipment?: ExerciseEquipment;
  onAdd: (name: string, equipment?: ExerciseEquipment) => void;
}

export function AddCustomExerciseRow({ query, firstEquipment, onAdd }: AddCustomExerciseRowProps) {
  const trimmed = query.trim();
  if (!trimmed) return null;

  return (
    <div className="px-3 py-2">
      <button
        type="button"
        onClick={() => onAdd(trimmed, firstEquipment)}
        className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-primary hover:bg-accent"
      >
        <Plus className="h-4 w-4 shrink-0" />
        <span>Add &ldquo;{trimmed}&rdquo; as new exercise</span>
      </button>
    </div>
  );
}
