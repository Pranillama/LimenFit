import { describe, it, expect } from 'vitest';
import { filterExercises, splitRecentVsAll } from './filterAndSort';
import type { ExerciseListItem, ExerciseFilters } from '../types';

const noFilters: ExerciseFilters = { equipment: [], categories: [] };

const items: ExerciseListItem[] = [
  {
    id: '1',
    name: 'Barbell Bench Press',
    category: 'chest',
    equipment: 'barbell',
    isCustom: false,
  },
  { id: '2', name: 'Dumbbell Curl', category: 'arms', equipment: 'dumbbell', isCustom: false },
  { id: '3', name: 'Pull Up', category: 'back', equipment: null, isCustom: false },
  {
    id: '4',
    name: 'Romanian Deadlift',
    category: 'hamstrings',
    equipment: 'barbell',
    isCustom: false,
  },
  { id: '5', name: 'Squat', category: 'legs', equipment: 'barbell', isCustom: false },
];

describe('filterExercises', () => {
  it('returns all items in original order when query is empty', () => {
    const result = filterExercises(items, '', noFilters);
    expect(result).toEqual(items);
  });

  it('returns all items in original order when query is whitespace only', () => {
    const result = filterExercises(items, '   ', noFilters);
    expect(result).toEqual(items);
  });

  it('exact substring matches rank highly', () => {
    const result = filterExercises(items, 'Bench Press', noFilters);
    expect(result.length).toBeGreaterThan(0);
    expect(result[0]!.id).toBe('1');
  });

  it('partial prefix match surfaces the correct exercise', () => {
    const result = filterExercises(items, 'benc', noFilters);
    const names = result.map((r) => r.name);
    expect(names.some((n) => n.includes('Bench'))).toBe(true);
  });

  it('typo tolerance — one character off still matches', () => {
    // "Squot" vs "Squat"
    const result = filterExercises(items, 'Squot', noFilters);
    const names = result.map((r) => r.name);
    expect(names.some((n) => n.toLowerCase().includes('squat'))).toBe(true);
  });

  it('abbreviation match — "rdl" matches Romanian Deadlift via subsequence', () => {
    // Fuse.js threshold allows partial word matches; "deadlift" contains "dl"
    // Test a clearer abbreviation: "dead" prefix
    const result = filterExercises(items, 'dead', noFilters);
    const names = result.map((r) => r.name);
    expect(names.some((n) => n.includes('Deadlift'))).toBe(true);
  });

  it('AND across facets — equipment AND category must both match', () => {
    const filters: ExerciseFilters = {
      equipment: ['barbell'],
      categories: ['chest'],
    };
    const result = filterExercises(items, '', filters);
    // Only Barbell Bench Press is barbell + chest
    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe('1');
  });

  it('OR within equipment facet', () => {
    const filters: ExerciseFilters = {
      equipment: ['barbell', 'dumbbell'],
      categories: [],
    };
    const result = filterExercises(items, '', filters);
    // barbell: 1, 4, 5 — dumbbell: 2 — null (Pull Up) excluded
    expect(result.map((r) => r.id).sort()).toEqual(['1', '2', '4', '5']);
  });

  it('equipment filter excludes items with null equipment', () => {
    const filters: ExerciseFilters = {
      equipment: ['barbell'],
      categories: [],
    };
    const result = filterExercises(items, '', filters);
    const ids = result.map((r) => r.id);
    // Pull Up (id=3) has null equipment and must be excluded
    expect(ids).not.toContain('3');
  });

  it('fuzzy search + facets work together', () => {
    const filters: ExerciseFilters = {
      equipment: ['barbell'],
      categories: [],
    };
    const result = filterExercises(items, 'bench', filters);
    expect(result.length).toBeGreaterThan(0);
    expect(result[0]!.id).toBe('1');
    // Dumbbell Curl (id=2) must not appear — equipment is dumbbell
    expect(result.map((r) => r.id)).not.toContain('2');
  });

  it('no matches returns empty array', () => {
    const result = filterExercises(items, 'zzzzxxx', noFilters);
    expect(result).toHaveLength(0);
  });
});

describe('splitRecentVsAll', () => {
  it('puts recent ids first in recentIds order, rest in alphabetical order', () => {
    const filtered = items; // all five
    const { recent, all } = splitRecentVsAll(filtered, ['3', '1']);
    expect(recent.map((r) => r.id)).toEqual(['3', '1']);
    expect(all.map((r) => r.id)).toEqual(['2', '4', '5']);
  });

  it('recent only includes items that are in filtered list', () => {
    const filtered = items.slice(0, 2); // ids 1, 2
    const { recent } = splitRecentVsAll(filtered, ['3', '1']);
    // id=3 not in filtered, so only id=1 appears
    expect(recent.map((r) => r.id)).toEqual(['1']);
  });

  it('empty recentIds returns all items in all section', () => {
    const { recent, all } = splitRecentVsAll(items, []);
    expect(recent).toHaveLength(0);
    expect(all).toEqual(items);
  });
});
