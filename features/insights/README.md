# features/insights

Cross-cutting fitness-insight pipeline: compute → store → render.

## Structure

```
features/insights/
  components/
    ConsistencyChart.tsx         Weekly workout-count bar chart
    InsightsEmptyCard.tsx        Shared empty-state card for all charts
    InsightsPanel.tsx            Home-page panel composing all insight cards
    MuscleGroupVolumeChips.tsx   Pill chips for top muscle groups by volume
    OneRepMaxTrendChart.tsx      Line chart — e1RM over time for one exercise
    VolumeTrendChart.tsx         Multi-line volume trend by muscle group / exercise
  lib/
    __tests__/                   Vitest unit tests for every pure kernel function
    consistency.ts               computeConsistencyScore()
    formatters.ts                formatVolume(), formatWeekLabel()
    messages.ts                  generateInsightMessages() — human-readable insight prose
    oneRepMax.ts                 estimateOneRepMax(), computeOneRepMaxSeries()
    plateau.ts                   detectPlateaus()
    types.ts                     Shared TypeScript types for the entire pipeline
    volumeTrend.ts               computeVolumeTrend()
    weekHelpers.ts               getMondayDate(), toIsoDateString()
```

## Upcoming (T20a)

The T20a ticket extends this pipeline with two new pure-function modules and rewrites the existing message generator. No schema changes, no new DB queries, no new runtime libraries. Full rule definitions and ranking order are in [`docs/superpowers/specs/2026-05-20-rule-based-insight-chips-design.md`](../../docs/superpowers/specs/2026-05-20-rule-based-insight-chips-design.md).

| File                 | Status     | Purpose                                                                                            |
| -------------------- | ---------- | -------------------------------------------------------------------------------------------------- |
| `personalRecords.ts` | new (T20a) | `derivePersonalRecords(oneRepMaxSeries)` → `PersonalRecord[]` (also consumed by T20b's tool layer) |
| `lastSeen.ts`        | new (T20a) | `deriveLastSeenByGroup(allExerciseSamples)` → `Record<MuscleGroup, string>`                        |
| `messages.ts`        | rewritten  | Four ranked rules: PR, Plateau (with prescription), Neglected group, Volume delta with numbers     |

Both new derivations are added to `InsightsBundle` inside `lib/insights/server.ts` and are computed alongside the existing kernels from data already loaded by `fetchWorkoutRows` — no extra round-trips.

The `InsightsBundle` shape gains two fields (`personalRecords`, `lastSeenByGroup`) but the cache key, the `insightsTag(userId)` invalidation contract, and the 1-hour revalidation window are unchanged.

## Server entry points (`lib/insights/`)

All Supabase I/O lives in `lib/insights/server.ts` (server-only module). The public API:

| Function                                            | Purpose                                                             |
| --------------------------------------------------- | ------------------------------------------------------------------- |
| `getInsightsBundle(userId)`                         | Full bundle for the home dashboard — all metrics in one cached call |
| `getOneRepMaxSeriesForExercise(userId, exerciseId)` | Per-exercise e1RM series for `/train/exercises/[id]`                |

Both are wrapped in `unstable_cache` with the tag `insights:<userId>` and a 1-hour revalidation.

## Cache invalidation contract

The tag `insightsTag(userId)` (exported from `lib/insights`) must be passed to `revalidateTag()` whenever the user's workout history changes. This is done in **`PATCH /api/workouts/[id]`** — after a workout is marked `completed`, the route calls `revalidateTag(insightsTag(userId))` to bust the cached bundle for that user.

Any future route that modifies sets, exercises, or workout status must do the same.

## Adding a new kernel metric

1. Add pure compute function in `features/insights/lib/` with a co-located `__tests__/` test.
2. Add the output type to `features/insights/lib/types.ts`.
3. Wire it into `getInsightsBundle` in `lib/insights/server.ts`.
4. If it needs a dedicated chart, add a client component under `features/insights/components/`.
