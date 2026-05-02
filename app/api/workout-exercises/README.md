# app/api/workout-exercises

Mutation surface for adding, reordering, and removing exercises from an active workout draft.

## Endpoints

### `POST /api/workout-exercises`

Adds an exercise to an `in_progress` workout. Returns `201 { id, clientMutationId }`.

- 404 if the workout doesn't exist or doesn't belong to the caller.
- 422 `WORKOUT_NOT_IN_PROGRESS` if the workout is completed or expired.
- 422 `INVALID_EXERCISE` if the exercise doesn't exist or isn't readable by the caller (global exercises have `user_id IS NULL`; user-created exercises carry the owner's `user_id`).

Idempotency key: `workoutExercise.add` — replays return `200` with the original `id`.

### `PATCH /api/workout-exercises/:id`

Reorders a single exercise by updating its `position`. Returns `200 { id, clientMutationId }`.

- 404 if the exercise doesn't exist or its parent workout is not `in_progress`.

**Non-atomic reorder:** The client sends one `PATCH` per moved exercise (see `useActiveWorkoutStore.reorderExercises`). There is no unique constraint on `(workout_id, position)`, so concurrent patches from multiple tabs are safe — last write wins per exercise row. Callers must not assume positions are globally consistent until all patches in a reorder sequence have settled.

Idempotency key: `workoutExercise.reorder`.

### `DELETE /api/workout-exercises/:id`

Removes an exercise from a workout. Child `sets` rows are removed via `ON DELETE CASCADE`. Returns `200 { id, clientMutationId }`.

- Already-deleted rows return `200` (idempotent).
- 422 `WORKOUT_NOT_IN_PROGRESS` if the row exists but its parent workout is completed or expired.

Idempotency key: `workoutExercise.remove`.

## Cross-cutting

All three handlers share:

- **Parent-ownership check** — verifies the parent workout belongs to the calling user.
- **`last_activity_at` touch** — bumps the parent workout's `last_activity_at` timestamp after every successful mutation so the active-draft list stays sorted by recency.
- **Idempotency** via `withIdempotency` (see `lib/idempotency/`).

`POST /api/exercises` (creating new exercise definitions) is out of scope — handled by T8.
