# app/api/workouts

Route handlers for the `workouts` table. All routes share the `workouts_one_active_draft_per_user` partial unique index (`WHERE status = 'in_progress'`), which enforces a single active draft per user and is the source of all `23505` conflict handling documented below.

All handlers:
- Call `requireUser()` — middleware does **not** cover `/api/*`.
- Wrap mutations in `withIdempotency` keyed on `clientMutationId`.
- Return errors via `handleApiError` — no unhandled exceptions reach the client.
- Use `runtime = 'nodejs'` (default); no `dynamic` overrides.

---

## `POST /api/workouts` — create draft

**File:** `route.ts`

**Auth:** session cookie (RLS scoped to `user_id`)

**Schema:** `workoutCreateBodySchema` — `{ clientMutationId, localId, name, planWorkoutId, originPlanWorkoutId, startedAt, lastActivityAt }`

> `originPlanWorkoutId` is accepted by the schema but intentionally not persisted — the DB column is `plan_workout_id`.

### Logic

1. SELECT existing `in_progress` draft for the user.
2. **If found:** return the existing draft with `alreadyExisted: true` and record the receipt with `resource_id = existingDraft.id`. No new row is inserted.
3. **If not found:** INSERT a new `in_progress` workout.
   - On `23505` (race with another tab between SELECT and INSERT): fall back to the "existing draft" branch.
4. Record the idempotency receipt.

### Responses

| Condition | Status | Body |
|-----------|--------|------|
| New draft created | `201` | `{ id, clientMutationId, alreadyExisted: false, existingDraft: null, name, startedAt, lastActivityAt, planWorkoutId }` |
| Active draft already existed | `200` | `{ id, clientMutationId, alreadyExisted: true, existingDraft: { id, name, startedAt, lastActivityAt, planWorkoutId } }` |
| Replay of a new-draft create | `200` | `{ id, clientMutationId, alreadyExisted: false, existingDraft: null, name, startedAt, lastActivityAt, planWorkoutId }` (original outcome preserved via response_metadata) |
| Replay of an existing-draft create | `200` | `{ id, clientMutationId, alreadyExisted: true, existingDraft: { … } }` (original outcome preserved via response_metadata) |
| Invalid body | `400` | `VALIDATION_ERROR` |
| Unauthenticated | `401` | `UNAUTHORIZED` |

### Idempotency contract

The idempotency wrapper (`withIdempotency`) stores `response_metadata` containing `{ alreadyExisted: boolean }`
on the first successful execution. On replay with the same `clientMutationId`, the route reconstructs the original
response shape using this metadata, ensuring the client sees a consistent outcome across retries.

- **First call:** Runs the handler, stores the `alreadyExisted` flag in `response_metadata`, and returns `201` (new)
  or `200` (existing).
- **Replay:** Looks up the stored metadata, re-fetches the workout row for consistency, and returns `200` with
  the original `alreadyExisted` status and `existingDraft` shape.

The `mutation_type` stored in the receipt remains the logical operation name (`'workout.create'`), not an
outcome-specific variant.

---

## `PATCH /api/workouts/[id]` — update draft

**File:** `[id]/route.ts`

**Auth:** session cookie (RLS scoped to `user_id`)

**Schema:** `workoutPatchBodySchema` — `{ clientMutationId, name?, status?, lastActivityAt? }`

> `status` is limited to `'in_progress' | 'completed'` by the schema. Sending `'expired'` yields `400 VALIDATION_ERROR` (cron-only transition).

### Logic

1. Validate `id` is a v4 UUID.
2. UPDATE where `id` AND `user_id` AND `status != 'expired'`. If 0 rows affected, re-fetch:
   - Row missing → `404`.
   - Row is `expired` → `422 WORKOUT_EXPIRED`.
3. Always sets `last_activity_at` to `lastActivityAt` from the request body, or `NOW()` if absent.
4. When `status === 'completed'`: a second UPDATE sets `completed_at = NOW()` constrained to `completed_at IS NULL`, preserving the original completion timestamp across concurrent requests.
5. Record the idempotency receipt with `resource_id = id`.

### Responses

| Condition | Status | Body |
|-----------|--------|------|
| Success | `200` | `{ id, clientMutationId }` |
| Replay | `200` | `{ id, clientMutationId }` |
| Not found | `404` | `NOT_FOUND` |
| Workout is expired | `422` | `WORKOUT_EXPIRED` |
| Invalid UUID | `400` | `INVALID_ID` |
| Invalid body | `400` | `VALIDATION_ERROR` |
| Unauthenticated | `401` | `UNAUTHORIZED` |

---

## `DELETE /api/workouts/[id]` — discard draft

**File:** `[id]/route.ts`

**Auth:** session cookie (RLS scoped to `user_id`)

**Schema:** `workoutDiscardBodySchema` — `{ clientMutationId }`

### Logic

1. Validate `id` is a v4 UUID.
2. DELETE where `id` AND `user_id` AND `status IN ('in_progress', 'expired')`. If 0 rows deleted, re-fetch:
   - Row missing → **200** (already discarded — idempotent).
   - Row still present (must be `completed`) → `422 CANNOT_DISCARD_COMPLETED`.
3. `ON DELETE CASCADE` removes child `workout_exercises` and `sets` automatically.
4. Record the idempotency receipt with `resource_id = id`.

### Responses

| Condition | Status | Body |
|-----------|--------|------|
| Discarded (or already gone) | `200` | `{ id, clientMutationId }` |
| Replay | `200` | `{ id, clientMutationId }` |
| Workout is completed | `422` | `CANNOT_DISCARD_COMPLETED` |
| Invalid UUID | `400` | `INVALID_ID` |
| Invalid body | `400` | `VALIDATION_ERROR` |
| Unauthenticated | `401` | `UNAUTHORIZED` |

> Completed workouts are managed through history delete (T10 concern), not this endpoint.

---

## `POST /api/workouts/[id]/restore` — restore expired workout

**File:** `[id]/restore/route.ts`

**Auth:** session cookie (RLS scoped to `user_id`)

**Schema:** `workoutRestoreBodySchema` — `{ clientMutationId }`

### Logic

1. Validate `id` is a v4 UUID.
2. Fetch target workout and assert `status === 'expired'`.
   - Not found → `404`.
   - Not expired → `422 NOT_EXPIRED`.
3. SELECT any existing `in_progress` draft.
   - Found → `422 ACTIVE_DRAFT_EXISTS` with `details.activeDraft`.
4. UPDATE `SET status = 'in_progress', expired_at = NULL, last_activity_at = NOW() WHERE status = 'expired'`.
   - `23505` unique-violation (race: another draft became active between step 3 and this UPDATE) → `422 ACTIVE_DRAFT_EXISTS`, re-fetching the active draft for the error body.
   - 0 rows affected (target changed between assertion and UPDATE) → `404`.
5. Record the idempotency receipt with `resource_id = id`.

### Why 422 instead of 409 for `ACTIVE_DRAFT_EXISTS`

The offline queue treats `409` as **retriable**, which would cause an infinite retry loop on a permanent conflict (user has an active draft that requires explicit action to resolve). `422` causes the queue to **quarantine** the mutation, surfacing it to the T10 UI so the user can take action.

### Responses

| Condition | Status | Body |
|-----------|--------|------|
| Restored | `200` | `{ id, clientMutationId, workout: { id, name, startedAt, lastActivityAt, planWorkoutId } }` |
| Replay | `200` | Same shape, workout re-fetched from DB |
| Not found / no longer expired | `404` | `NOT_FOUND` |
| Target not in expired state | `422` | `NOT_EXPIRED` |
| Active draft exists | `422` | `ACTIVE_DRAFT_EXISTS` with `details.activeDraft: { id, name, startedAt, lastActivityAt, planWorkoutId }` |
| Invalid UUID | `400` | `INVALID_ID` |
| Invalid body | `400` | `VALIDATION_ERROR` |
| Unauthenticated | `401` | `UNAUTHORIZED` |

---

## Shared error body shape

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable description",
    "details": {}
  }
}
```

`details` is omitted when there is no extra context.
