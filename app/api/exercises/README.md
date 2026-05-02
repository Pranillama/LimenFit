# app/api/exercises

Exercises API route handler. Implemented in T8.

## Route

`POST /api/exercises` — creates a custom exercise for the authenticated user.

## Schema

Request body is validated with `exerciseCreateBodySchema` from
[`lib/schemas/exercise.ts`](../../../lib/schemas/exercise.ts)
(re-exported from `lib/schemas`):

| Field | Type | Notes |
|-------|------|-------|
| `clientMutationId` | `string` (UUID) | Idempotency key — see contract below |
| `name` | `string` | Trimmed, 1–100 characters |
| `category` | `ExerciseCategory` | Must be a value from `EXERCISE_CATEGORIES` in `lib/exercises/catalog.ts` |
| `equipment` | `ExerciseEquipment \| null` | Optional; defaults to `null` when omitted |

## Idempotency

This route uses `withIdempotency` from
[`lib/idempotency/server.ts`](../../../lib/idempotency/README.md).
The `clientMutationId` in the request body is the idempotency key. Duplicate
requests with the same key return the original response without re-inserting.

`mutationType` stored in `mutation_receipts`: `exercise.create`.

## Catalog

Valid `category` and `equipment` values are defined in
[`lib/exercises/catalog.ts`](../../../lib/exercises/catalog.ts) — the single
source of truth shared by this schema, the filter UI, and the custom-exercise dialog.
