import type { ExerciseListItem, ExerciseFilters } from '../types';

/**
 * Filter strategy:
 *   - Within each facet: OR  (e.g. equipment=[barbell,dumbbell] → barbell OR dumbbell)
 *   - Across facets:     AND (equipment filter AND category filter must both pass)
 *   - Text: all whitespace-split tokens must appear as case-insensitive substrings of the name
 *
 * Preserves the upstream alphabetical sort order; never re-sorts.
 */
export function filterExercises(
  items: ExerciseListItem[],
  q: string,
  filters: ExerciseFilters,
): ExerciseListItem[] {
  const trimmed = q.trim().toLowerCase();
  const tokens = trimmed ? trimmed.split(/\s+/) : [];

  return items.filter((item) => {
    if (filters.categories.length > 0 && !filters.categories.includes(item.category)) {
      return false;
    }

    if (filters.equipment.length > 0) {
      if (item.equipment === null || !filters.equipment.includes(item.equipment)) {
        return false;
      }
    }

    if (tokens.length > 0) {
      const name = item.name.toLowerCase();
      return tokens.every((token) => name.includes(token));
    }

    return true;
  });
}

/**
 * Splits a filtered list into two sections:
 *   - `recent`: items whose id appears in `recentIds`, in recentIds order
 *   - `all`: remaining items in their original (alphabetical) order
 */
export function splitRecentVsAll(
  filtered: ExerciseListItem[],
  recentIds: string[],
): { recent: ExerciseListItem[]; all: ExerciseListItem[] } {
  const filteredById = new Map(filtered.map((item) => [item.id, item]));
  const recentIdSet = new Set(recentIds);

  const recent = recentIds.filter((id) => filteredById.has(id)).map((id) => filteredById.get(id)!);

  const all = filtered.filter((item) => !recentIdSet.has(item.id));

  return { recent, all };
}
