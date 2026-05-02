# app/api/workout-exercises

Mutation surface for adding, reordering, and removing exercises from an active workout draft.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/workout-exercises` | Add an exercise to an in_progress workout |
| `PATCH` | `/api/workout-exercises/[id]` | Reorder a single exercise by position |
| `DELETE` | `/api/workout-exercises/[id]` | Remove an exercise (cascades child sets) |

All handlers:
- Authenticate via `requireUser()`.
- Wrap mutations in `withIdempotency` — safe to retry from the offline queue.
- Call `touchWorkoutLastActivity()` on the parent workout after each successful mutation.

---

## `POST /api/workout-exercises` — add exercise

**File:** `route.ts`

**Schema:** `workoutExerciseAddBodySchema`

```json
{
  "clientMutationId": "<v4 UUID>",
  "localId":          "<v4 UUID>",
  "workoutId":        "<v4 UUID>",
  "exerciseId":       "<v4 UUID>",
  "position":         0
}
```

### Responses

| Condition | Status | Body |
|-----------|--------|------|
| Created | `201` | `{ id, clientMutationId }` |
| Replay | `200` | `{ id, clientMutationId }` |
| Workout not found | `404` | `NOT_FOUND` |
| Workout not `in_progress` | `422` | `WORKOUT_NOT_IN_PROGRESS` |
| Exercise not found/accessible | `422` | `INVALID_EXERCISE` |
| Invalid body | `400` | `VALIDATION_ERROR` |
| Unauthenticated | `401` | `UNAUTHORIZED` |

**Idempotency key:** `workoutExercise.add` — replays return `200` with the original `id`.

---

## `PATCH /api/workout-exercises/[id]` — reorder

**File:** `[id]/route.ts`

**Schema:** `workoutExerciseReorderBodySchema`

```json
{
  "clientMutationId": "<v4 UUID>",
  "position":         3
}
```

### Responses

| Condition | Status | Body |
|-----------|--------|------|
| Success | `200` | `{ id, clientMutationId }` |
| Replay | `200` | `{ id, clientMutationId }` |
| Exercise not found or parent not `in_progress` | `404` | `NOT_FOUND` |
| Invalid UUID in path | `400` | `INVALID_ID` |
| Invalid body | `400` | `VALIDATION_ERROR` |
| Unauthenticated | `401` | `UNAUTHORIZED` |

**Idempotency key:** `workoutExercise.reorder`

**Non-atomic reorder:** The client sends one `PATCH` per moved exercise (see `useActiveWorkoutStore.reorderExercises`). There is no unique constraint on `(workout_id, position)`, so concurrent patches from multiple tabs are safe — last write wins per exercise row. Callers must not assume positions are globally consistent until all patches in a reorder sequence have settled.

---

## `DELETE /api/workout-exercises/[id]` — remove

**File:** `[id]/route.ts`

**Schema:** `workoutExerciseDeleteBodySchema`

```json
{
  "clientMutationId": "<v4 UUID>"
}
```

### Responses

| Condition | Status | Body |
|-----------|--------|------|
| Deleted (or already gone) | `200` | `{ id, clientMutationId }` |
| Replay | `200` | `{ id, clientMutationId }` |
| Parent workout not `in_progress` | `422` | `WORKOUT_NOT_IN_PROGRESS` |
| Invalid UUID in path | `400` | `INVALID_ID` |
| Invalid body | `400` | `VALIDATION_ERROR` |
| Unauthenticated | `401` | `UNAUTHORIZED` |

Child `sets` rows are removed via `ON DELETE CASCADE`. Already-deleted rows return `200` (idempotent).

**Idempotency key:** `workoutExercise.remove`

---

## Cross-cutting

All three handlers share:

- **Parent-ownership check** — verifies the parent workout belongs to the calling user.
- **`last_activity_at` touch** — bumps the parent workout's `last_activity_at` timestamp after every successful mutation so the active-draft list stays sorted by recency.
- **Idempotency** via `withIdempotency` (see [`lib/idempotency/`](../../../lib/idempotency/README.md)).

`POST /api/exercises` (creating new exercise definitions) is out of scope — handled by T8.

## Shared error body shape

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable description"
  }
}
```
