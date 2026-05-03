# features/exercise-picker

Exercise picker feature. Implemented in T8.

## Public component contract

`ExercisePicker` is the reusable modal that lets the user search, filter, and
select one or more exercises to add to a workout. It is exported from
`features/exercise-picker` (barrel) and accepts `ExercisePickerProps`:

| Prop | Type | Description |
|------|------|-------------|
| `open` | `boolean` | Controls dialog open state |
| `onOpenChange` | `(open: boolean) => void` | Called when the dialog requests close |
| `onConfirm` | `(exerciseIds: string[]) => void` | Called with the selected exercise IDs when the user confirms |
| `title` | `string?` | Optional dialog heading |
| `confirmLabelPrefix` | `string?` | Prefix for the confirm button label (default `"Add"`) |

## Catalog

All valid category and equipment values are defined in
[`lib/exercises/catalog.ts`](../../lib/exercises/catalog.ts). This file is the
**single source of truth** shared by the API validation schema, the filter sheet, and the
custom-exercise create dialog. It exports:

- `EXERCISE_CATEGORIES` / `EXERCISE_EQUIPMENT` — `readonly` tuples used for `z.enum()`
- `EXERCISE_CATEGORY_OPTIONS` / `EXERCISE_EQUIPMENT_OPTIONS` — `{ value, label }` arrays
  for rendering filter controls
- `ExerciseCategory` / `ExerciseEquipment` — TypeScript types derived from the tuples

## Zod schema

`exerciseCreateBodySchema` (and its inferred `ExerciseCreateBody` type) lives in
[`lib/schemas/exercise.ts`](../../lib/schemas/exercise.ts) and is re-exported from
the `lib/schemas` barrel. It validates the body sent to `POST /api/exercises`.

## Supporting types

`ExerciseListItem`, `ExercisePreview`, `ExerciseFilters`, and `ExercisePickerProps` are
defined in [`features/exercise-picker/types.ts`](./types.ts) and exported from the barrel.

## Data layer

All data hooks live under [`features/exercise-picker/hooks/`](./hooks/) and use
`createSupabaseBrowserClient` from `lib/supabase/browser.ts`. The `QueryClient` is
provided by `app/providers.tsx`.

### `useExercisesQuery`

Fetches the full exercise library (`['exercises', 'library']`).
`staleTime: 10 min` — long revalidation window since the catalog changes rarely.
RLS returns rows where `user_id IS NULL OR user_id = auth.uid()`, so no extra filter
is needed.

### `useRecentExercisesQuery`

Fetches the user's 10 most recently used exercises (`['exercises', 'recent', userId]`).
`staleTime: 60 s`.

Returns `{ recentIds: string[]; previews: Map<exerciseId, ExercisePreview> }` where
`ExercisePreview` carries the weight/reps from the last logged set for quick display.
Returns `{ recentIds: [], previews: new Map() }` when the user has no workouts yet.

Uses a private `useSessionUserId` helper (react-query `staleTime: Infinity`) to key
the cache per user so different users on the same device get separate caches.

### `useCreateExerciseMutation`

POSTs to `/api/exercises`. Generates a `clientMutationId` via `newClientMutationId()`
from `lib/idempotency` and sends it as both the `Idempotency-Key` header and a JSON body
field, matching the `dispatchMutation` pattern in `features/workout/store/queue.ts`.

On success:
- Optimistically prepends the new exercise to `['exercises', 'library']` cache so it
  appears in the picker immediately.
- Invalidates `['exercises']` (covers both `library` and `recent`) to trigger a refetch
  that restores alphabetical order and updates recent exercises.

On error: surfaces a `toast.error` via `components/ui/sonner`.

Returns `ExerciseListItem` so the dialog can auto-select the new exercise (Phase 6).

## Filter helpers

Pure functions in [`features/exercise-picker/lib/filterAndSort.ts`](./lib/filterAndSort.ts).
No React, no Supabase — trivially unit-testable.

### `filterExercises(items, q, filters)`

- Equipment and category filters: OR within facet, AND across facets.
- Text search: all whitespace-split tokens must appear as case-insensitive substrings of
  the exercise name.
- Preserves upstream alphabetical sort order.

### `splitRecentVsAll(filtered, recentIds)`

Splits filtered results into `{ recent, all }` where `recent` preserves `recentIds` order
and `all` contains the remaining items in their original (alphabetical) order.

## Other UI notes

Use `DiscardConfirmationDialog` from `@/components/discard-confirmation-dialog` for any
cancel-with-unsaved-work flow (default focus on Keep Editing, two-button modal, controlled
`open` state).
