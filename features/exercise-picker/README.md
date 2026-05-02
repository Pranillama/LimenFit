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

## Other UI notes

Use `DiscardConfirmationDialog` from `@/components/discard-confirmation-dialog` for any
cancel-with-unsaved-work flow (default focus on Keep Editing, two-button modal, controlled
`open` state).
