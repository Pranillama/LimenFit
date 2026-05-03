# features/exercise-picker

Exercise picker feature. Implemented across T8 (shell + state), T9 (data layer), and T10 (custom-exercise dialog + data round-trip).

## Public component contract

`ExercisePicker` is a full-height bottom sheet that lets the user search, filter, and select
one or more exercises to add to a workout or plan. Import from the barrel:

```ts
import { ExercisePicker } from '@/features/exercise-picker';
```

`ExercisePickerProps`:

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `open` | `boolean` | ✓ | Controls sheet open state |
| `onOpenChange` | `(open: boolean) => void` | ✓ | Called when the sheet requests close |
| `onConfirm` | `(exerciseIds: string[]) => void` | ✓ | Called with selected exercise IDs when the user taps Add |
| `title` | `string` | — | Sheet heading (default `"Select Exercises"`) |

**`onConfirm` type contract**: receives an array of canonical `exercises.id` UUIDs that exist
in the database (both global catalog rows and user-created custom exercises). All IDs are
persisted before `onConfirm` fires — consumers can pass them directly to any server mutation
without a separate existence check.

### Close behaviour

All close attempts (header ×, overlay tap, Escape key) route through `attemptClose`.
If no exercises are selected the sheet closes immediately. If any are selected, a
`DiscardConfirmationDialog` appears and the sheet only closes after the user confirms the
discard. The Cancel button inside `CustomExerciseDialog` closes the dialog silently without
triggering the outer discard flow.

State resets every time `open` transitions from `false` to `true`, so every new picker
session starts fresh regardless of how the previous session ended.

## Consumer examples

### Active-workout (T11)

```tsx
import { ExercisePicker } from '@/features/exercise-picker';
import { useActiveWorkoutStore } from '@/features/workout/store';

function AddExercisesButton() {
  const [open, setOpen] = useState(false);

  function handleConfirm(exerciseIds: string[]) {
    useActiveWorkoutStore.getState().addExercises(exerciseIds);
  }

  return (
    <>
      <button onClick={() => setOpen(true)}>Add exercises</button>
      <ExercisePicker
        open={open}
        onOpenChange={setOpen}
        onConfirm={handleConfirm}
        title="Add Exercises"
      />
    </>
  );
}
```

### Plan editor (T12)

```tsx
import { ExercisePicker } from '@/features/exercise-picker';

function PlanDayEditor({ dayId }: { dayId: string }) {
  const [open, setOpen] = useState(false);
  const addExercisesToDay = usePlanStore((s) => s.addExercisesToDay);

  function handleConfirm(exerciseIds: string[]) {
    addExercisesToDay(dayId, exerciseIds);
  }

  return (
    <>
      <button onClick={() => setOpen(true)}>Add exercises</button>
      <ExercisePicker
        open={open}
        onOpenChange={setOpen}
        onConfirm={handleConfirm}
        title="Add to Day"
      />
    </>
  );
}
```

## CustomExerciseDialog

Opened automatically when the user taps "Add `'X'` as new exercise" (the empty-state CTA
shown when a search query returns no results).

`CustomExerciseDialogProps` (internal — consumed only by `ExercisePicker`):

| Prop | Type | Description |
|------|------|-------------|
| `open` | `boolean` | Controlled open state |
| `onOpenChange` | `(open: boolean) => void` | Close handler |
| `defaultName` | `string` | Pre-filled from the search query |
| `defaultEquipment` | `ExerciseEquipment \| null \| undefined` | Pre-filled from the first active equipment filter |
| `onCreated` | `(item: ExerciseListItem) => void` | Called on success; parent auto-selects the new ID |

On success the dialog:
1. Calls `mutation.mutateAsync` (POST `/api/exercises`) — see [API route](#api-route) below.
2. Fires a `toast.success('Exercise created')`.
3. Calls `onCreated(item)` — `ExercisePicker` appends the new ID to `selectedIds` and clears
   the search query so the exercise surfaces immediately in "All Exercises".
4. Closes.

On error the dialog stays open and renders the server error message inline (a `toast.error`
is also fired inside the mutation hook for ambient visibility).

## API route

`POST /api/exercises`

Request body (validated by `exerciseCreateBodySchema` from `lib/schemas/exercise.ts`):

```jsonc
{
  "clientMutationId": "<uuid>",   // idempotency key, also sent as Idempotency-Key header
  "name": "Incline Cable Fly",
  "category": "chest",
  "equipment": "cable"            // null or omitted → bodyweight / no equipment
}
```

Response (201):

```jsonc
{
  "id": "<uuid>",
  "clientMutationId": "<uuid>",
  "name": "Incline Cable Fly",
  "category": "chest",
  "equipment": "cable",
  "isCustom": true
}
```

## Catalog

All valid category and equipment values are defined in
[`lib/exercises/catalog.ts`](../../lib/exercises/catalog.ts). This file is the
**single source of truth** shared by the API validation schema, the filter sheet, and
`CustomExerciseDialog`. It exports:

- `EXERCISE_CATEGORIES` / `EXERCISE_EQUIPMENT` — `readonly` tuples used for `z.enum()`
- `EXERCISE_CATEGORY_OPTIONS` / `EXERCISE_EQUIPMENT_OPTIONS` — `{ value, label }` arrays
  for rendering filter controls and dialog selects
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

### `useCreateExerciseMutation`

POSTs to `/api/exercises`. Generates a `clientMutationId` via `newClientMutationId()`
from `lib/idempotency` and sends it as both the `Idempotency-Key` header and a JSON body
field.

On success:
- Optimistically prepends the new exercise to `['exercises', 'library']` cache so it
  appears in the picker immediately without waiting for the network refetch.
- Invalidates `['exercises']` (covers both `library` and `recent`) to trigger a refetch
  that restores alphabetical order.

On error: surfaces a `toast.error` via `components/ui/sonner`.

Returns `ExerciseListItem` so `CustomExerciseDialog` can pass the new item to its
`onCreated` callback and `ExercisePicker` can auto-select it.

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

- `DiscardConfirmationDialog` from `@/components/discard-confirmation-dialog` handles
  cancel-with-unsaved-selection. Default focus is on "Keep Editing". The Cancel button
  inside `CustomExerciseDialog` does **not** trigger this dialog — it closes silently.
- `CustomExerciseDialog` is mounted as a sibling of `Sheet` (same pattern as
  `FilterBottomSheet`) so Radix's dismissable-layer stack stays correct.
