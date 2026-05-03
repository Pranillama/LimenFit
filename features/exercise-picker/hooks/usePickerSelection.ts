'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import type { ExerciseCategory, ExerciseEquipment } from '@/lib/exercises/catalog';

import type { ExerciseFilters } from '../types';

const EMPTY_FILTERS: ExerciseFilters = { equipment: [], categories: [] };

export function usePickerSelection(open: boolean) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<ExerciseFilters>(EMPTY_FILTERS);
  const [showDiscardDialog, setShowDiscardDialog] = useState(false);

  const prevOpenRef = useRef(open);
  useEffect(() => {
    if (!prevOpenRef.current && open) {
      setSelectedIds(new Set());
      setQuery('');
      setFilters(EMPTY_FILTERS);
      setShowDiscardDialog(false);
    }
    prevOpenRef.current = open;
  }, [open]);

  const toggleExercise = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const addEquipment = useCallback((equipment: ExerciseEquipment) => {
    setFilters((prev) => ({
      ...prev,
      equipment: prev.equipment.includes(equipment)
        ? prev.equipment
        : [...prev.equipment, equipment],
    }));
  }, []);

  const removeEquipment = useCallback((equipment: ExerciseEquipment) => {
    setFilters((prev) => ({
      ...prev,
      equipment: prev.equipment.filter((e) => e !== equipment),
    }));
  }, []);

  const addCategory = useCallback((category: ExerciseCategory) => {
    setFilters((prev) => ({
      ...prev,
      categories: prev.categories.includes(category)
        ? prev.categories
        : [...prev.categories, category],
    }));
  }, []);

  const removeCategory = useCallback((category: ExerciseCategory) => {
    setFilters((prev) => ({
      ...prev,
      categories: prev.categories.filter((c) => c !== category),
    }));
  }, []);

  const clearFilters = useCallback(() => {
    setFilters(EMPTY_FILTERS);
  }, []);

  const reset = useCallback(() => {
    setSelectedIds(new Set());
    setQuery('');
    setFilters(EMPTY_FILTERS);
    setShowDiscardDialog(false);
  }, []);

  return {
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
  };
}
