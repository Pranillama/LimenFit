# app/api/sets

Mutation surface for logged sets — the highest-frequency API calls in the app (one per set logged).

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/sets` | Log a set (create) |
| `PATCH` | `/api/sets/[id]` | Edit a logged set (inline editing) |
| `DELETE` | `/api/sets/[id]` | Remove a logged set |

All handlers:
- Authenticate via `requireUser()`.
- Wrap mutations in `withIdempotency` — safe to retry from the offline queue.
- Call `touchWorkoutLastActivity()` on the grandparent workout after each successful mutation.

---

## `POST /api/sets` — log a set

**File:** `route.ts`

**Schema:** `setLogBodySchema`

```json
{
  "clientMutationId": "<v4 UUID>",
  "localId":          "<v4 UUID>",
  "workoutExerciseId":"<v4 UUID>",
  "setNumber":        1,
  "reps":             10,
  "weightValue":      60.5,
  "weightUnit":       "kg",
  "loggedAt":         "2026-05-01T10:00:00.000Z"
}
```

### Responses

| Condition | Status | Body |
|-----------|--------|------|
| Created | `201` | `{ id, clientMutationId }` |
| Replay | `200` | `{ id, clientMutationId }` |
| Workout exercise not found | `404` | `NOT_FOUND` |
| Parent workout not `in_progress` | `422` | `WORKOUT_NOT_IN_PROGRESS` |
| Invalid body | `400` | `VALIDATION_ERROR` |
| Unauthenticated | `401` | `UNAUTHORIZED` |

**Idempotency key:** `set.log` — replays return `200` with the original `id`.

---

## `PATCH /api/sets/[id]` — edit a logged set

**File:** `[id]/route.ts`

**Schema:** `setEditBodySchema` — requires at least one of `reps`, `weightValue`, or `weightUnit`.

```json
{
  "clientMutationId": "<v4 UUID>",
  "reps":             12,
  "weightValue":      70,
  "weightUnit":       "lbs"
}
```

> A body with only `clientMutationId` and no edit fields is rejected with `400 VALIDATION_ERROR`.

### Responses

| Condition | Status | Body |
|-----------|--------|------|
| Success | `200` | `{ id, clientMutationId }` |
| Replay | `200` | `{ id, clientMutationId }` |
| Set not found | `404` | `NOT_FOUND` |
| Invalid UUID in path | `400` | `INVALID_ID` |
| Invalid body | `400` | `VALIDATION_ERROR` |
| Unauthenticated | `401` | `UNAUTHORIZED` |

**Idempotency key:** `set.edit`

---

## `DELETE /api/sets/[id]` — remove a logged set

**File:** `[id]/route.ts`

**Schema:** `setDeleteBodySchema`

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
| Invalid UUID in path | `400` | `INVALID_ID` |
| Invalid body | `400` | `VALIDATION_ERROR` |
| Unauthenticated | `401` | `UNAUTHORIZED` |

**Idempotency key:** `set.delete` — missing rows are treated as already deleted (idempotent `200`).

---

## Ownership check

Each handler resolves the grandparent workout via a join (`workout_exercises!inner → workouts!inner`) in a single round trip. RLS on `workouts` (`user_id = auth.uid()`) enforces ownership; the `!inner` modifier propagates the filter so a missing or foreign-user workout causes the lookup row to be absent (→ 404 on PATCH, idempotent 200 on DELETE).

## Status gating

- **POST** requires the parent workout to be `in_progress`. Logging to a completed/expired workout → 422.
- **PATCH / DELETE** have **no** status gate — Flow 6 (inline editing) allows modifying or removing sets in completed workouts without re-opening them.

## `weight_unit` is per-set

`weight_unit` is stored on each `sets` row, **not** on the workout or the user profile. A future per-set unit-toggle UI (e.g. mixing lbs and kg in a single session) works without any server-side changes — the client simply passes the desired `weightUnit` on each `POST` or `PATCH`.

## Shared error body shape

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable description"
  }
}
```

`details` is included when there is extra context (e.g. Zod `issues` array on validation failures).
