# lib/api

Server-side helpers shared by all T7 route handlers. No HTTP routes are defined here —
these are pure plumbing consumed by `app/api/**` route files.

## Files

| File              | Exports                                                | Description                               |
| ----------------- | ------------------------------------------------------ | ----------------------------------------- |
| `auth.ts`         | `requireUser()`, `ApiAuthError`                        | Session verification for route handlers   |
| `responses.ts`    | `jsonOk`, `jsonCreated`, `jsonError`, `handleApiError` | Typed HTTP response constructors          |
| `touchWorkout.ts` | `touchWorkoutLastActivity`                             | Bumps `last_activity_at` on a workout row |

---

## `auth.ts`

### `requireUser()`

```ts
const { supabase, user } = await requireUser();
```

Creates a session-scoped Supabase client and calls `auth.getUser()`. Throws
`ApiAuthError` when the session is missing or invalid.

**Important:** `middleware.ts` does **not** protect `/api/*` routes. Every route handler
must call `requireUser()` explicitly — do not rely on middleware for API auth enforcement.

### `ApiAuthError`

A typed error class used by `handleApiError` to produce a `401 UNAUTHORIZED` response.

---

## `responses.ts`

### Response constructors

```ts
jsonOk(data, init?)    // 200 — with optional ResponseInit overrides
jsonCreated(data)      // 201
jsonError(status, code, message, extra?)
```

All error responses follow the standard body shape:

```json
{ "error": { "code": "STRING", "message": "human-readable", "details": {} } }
```

`details` is omitted when `extra` is not provided.

### `handleApiError(err)`

Top-level catch-all for route handlers:

```ts
export async function POST(request: Request) {
  try {
    // ...
  } catch (err) {
    return handleApiError(err);
  }
}
```

| Error type      | Response                                     |
| --------------- | -------------------------------------------- |
| `ZodError`      | `400 VALIDATION_ERROR` with `details.issues` |
| `ApiAuthError`  | `401 UNAUTHORIZED`                           |
| Everything else | re-thrown (Next.js surfaces as 500)          |

PostgREST unique-violation errors (`23505`) that arise inside `withIdempotency` are
already normalized to replay outcomes before reaching `handleApiError`, so they do not
need special handling here.

---

## `touchWorkout.ts`

### `touchWorkoutLastActivity(supabase, workoutId, ts)`

```ts
await touchWorkoutLastActivity(supabase, workout.id, new Date().toISOString());
```

Issues a single `UPDATE workouts SET last_activity_at = $ts WHERE id = $workoutId`
filtered to exclude `status IN ('completed', 'expired')`. If the workout is already in a
terminal state, the UPDATE matches zero rows and returns silently — no error is thrown.

Called by every child-resource mutation handler (workout-exercise add/remove/reorder,
set log/edit/delete) to keep `last_activity_at` current. RLS scopes the UPDATE to the
calling user's rows.
