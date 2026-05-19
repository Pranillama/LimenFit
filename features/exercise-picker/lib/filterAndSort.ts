import Fuse from 'fuse.js';
import type { ExerciseListItem, ExerciseFilters } from '../types';

/**
 * Filter strategy:
 *   - Within each facet: OR  (e.g. equipment=[barbell,dumbbell] → barbell OR dumbbell)
 *   - Across facets:     AND (equipment filter AND category filter must both pass)
 *   - Text (non-empty query): fuzzy search on `name` via Fuse.js
 *       · Typo-tolerant: small edit distances are tolerated (threshold 0.4)
 *       · Ranked by relevance score: best matches first
 *       · Empty query: all facet-matching items preserved in original alphabetical order
 *   - Equipment filter: items with `equipment === null` are excluded when the
 *     equipment facet is active (they have no equipment to match against)
 */
export function filterExercises(
  items: ExerciseListItem[],
  q: string,
  filters: ExerciseFilters,
): ExerciseListItem[] {
  // Apply faceted filters first (OR within facet, AND across facets)
  const facetFiltered = items.filter((item) => {
    if (filters.categories.length > 0 && !filters.categories.includes(item.category)) {
      return false;
    }

    if (filters.equipment.length > 0) {
      if (item.equipment === null || !filters.equipment.includes(item.equipment)) {
        return false;
      }
    }

    return true;
  });

  const trimmed = q.trim();
  if (!trimmed) {
    // Empty query: return facet-filtered items in their original alphabetical order
    return facetFiltered;
  }

  // Non-empty query: fuzzy search over the facet-filtered set, ranked by relevance
  const fuse = new Fuse(facetFiltered, {
    keys: ['name'],
    // 0 = perfect match only, 1 = match anything; 0.4 tolerates ~2-char typos
    threshold: 0.4,
    // Return score so we can rely on Fuse's own sort (best first)
    includeScore: true,
    // Favour prefix / contiguous matches via location bias
    minMatchCharLength: 1,
    ignoreLocation: false,
    location: 0,
    distance: 200,
  });

  return fuse.search(trimmed).map((result) => result.item);
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
