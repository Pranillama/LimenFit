# app/api/plans

Plans API route handlers. Implemented in T11.

## Routes

| Method   | Path              | Mutation type  | Purpose                                                                 |
| -------- | ----------------- | -------------- | ----------------------------------------------------------------------- |
| `POST`   | `/api/plans`      | `plan.create`  | Create a plan with nested workouts and exercises in one atomic RPC call |
| `PATCH`  | `/api/plans/[id]` | `plan.patch`   | Rename a plan and/or full-replace its workouts and exercises            |
| `DELETE` | `/api/plans/[id]` | `plan.discard` | Delete a plan; ON DELETE CASCADE handles child cleanup                  |

All three handlers are wrapped with `withIdempotency` (see [`lib/idempotency/`](../../../lib/idempotency/README.md)) so retries with the same `clientMutationId` are safe.
