# app/api/exercises

Exercises API route handler. Implemented in T8.

## Route

`POST /api/exercises` — creates a custom exercise for the authenticated user.

## Request body

Validated with `exerciseCreateBodySchema` from
[`lib/schemas/exercise.ts`](../../../lib/schemas/exercise.ts):

| Field              | Type                        | Required | Notes                                                                    |
| ------------------ | --------------------------- | -------- | ------------------------------------------------------------------------ |
| `clientMutationId` | `string` (UUID v4)          | yes      | Idempotency key — see contract below                                     |
| `name`             | `string`                    | yes      | Trimmed, 1–100 characters                                                |
| `category`         | `ExerciseCategory`          | yes      | Must be a value from `EXERCISE_CATEGORIES` in `lib/exercises/catalog.ts` |
| `equipment`        | `ExerciseEquipment \| null` | no       | Optional; defaults to `null` when omitted                                |

## Success response

| Status        | When                                              |
| ------------- | ------------------------------------------------- |
| `201 Created` | First call — exercise row inserted                |
| `200 OK`      | Replay — `clientMutationId` was already processed |

Both statuses return the same JSON body shape:

```json
{
  "id": "<uuid>",
  "clientMutationId": "<uuid>",
  "name": "Push-up",
  "category": "chest",
  "equipment": null,
  "isCustom": true
}
```

`isCustom` is always `true` for exercises created through this endpoint.

On replay, the row is re-fetched by `id` under the user-scoped client so the echoed
`name`, `category`, and `equipment` reflect the persisted values.

## Error codes

| HTTP  | `error.code`                   | Cause                                                                                         |
| ----- | ------------------------------ | --------------------------------------------------------------------------------------------- |
| `400` | `VALIDATION_ERROR`             | Request body fails `exerciseCreateBodySchema` (missing field, wrong type, invalid enum value) |
| `400` | `IDEMPOTENCY_VALIDATION_ERROR` | `clientMutationId` is not a valid UUID v4                                                     |
| `401` | `UNAUTHORIZED`                 | No valid session; `requireUser()` threw `ApiAuthError`                                        |
| `500` | `INTERNAL_SERVER_ERROR`        | Unexpected database or runtime error                                                          |

## Idempotency contract

This route uses `withIdempotency` from
[`lib/idempotency/server.ts`](../../../lib/idempotency/README.md).
`clientMutationId` is the idempotency key; duplicate requests with the same key return
the original response without re-inserting. See the full contract in
[`lib/idempotency/README.md`](../../../lib/idempotency/README.md).

`mutationType` stored in `mutation_receipts`: **`exercise.create`**.

## Uniqueness

No uniqueness constraint is enforced on `(user_id, name)`. The seeded library already
contains common exercise names and users may legitimately want a custom exercise with a
duplicate display name. Deduplication is provided exclusively by `clientMutationId` via
`mutation_receipts`.

## Catalog

Valid `category` and `equipment` values are defined in
[`lib/exercises/catalog.ts`](../../../lib/exercises/catalog.ts) — the single source of
truth shared by this schema, the filter UI, and the custom-exercise dialog.
