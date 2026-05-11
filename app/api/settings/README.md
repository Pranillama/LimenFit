# app/api/settings

User settings API route handler. Implemented in T15.

## PATCH /api/settings

Updates the authenticated user's settings. Creates the row if it does not yet exist (upsert on `user_id`).

### Request body

| Field | Type | Required |
|-------|------|----------|
| `weightUnit` | `"lbs" \| "kg"` | At least one required |
| `restTimerDefaultSeconds` | integer 0–600 | At least one required |

At least one field must be present; a body with neither is rejected with `400 VALIDATION_ERROR`.

### Response (200 OK)

```json
{
  "weightUnit": "kg",
  "restTimerDefaultSeconds": 90
}
```

The response always reflects the **canonical row** after the upsert. Fields not included in the request body retain their current (or DB-default) values.

### Non-queueable

This route does not use `withIdempotency` / `clientMutationId`. Settings updates are online-only and optimistic; no replay receipt is needed.
