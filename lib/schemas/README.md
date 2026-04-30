# lib/schemas

Shared Zod schemas used across API routes and feature tickets (T7, T8, T11, T15).

## Files

| File | Schemas |
|------|---------|
| `index.ts` | Barrel — re-exports all schemas below plus `loginSchema` / `signUpSchema` |
| `workout.ts` | `workoutCreateBodySchema`, `workoutPatchBodySchema`, `workoutDiscardBodySchema`, `workoutRestoreBodySchema` |
| `workout-exercise.ts` | `workoutExerciseAddBodySchema`, `workoutExerciseReorderBodySchema`, `workoutExerciseDeleteBodySchema` |
| `set.ts` | `setLogBodySchema`, `setEditBodySchema`, `setDeleteBodySchema` |

## Conventions

**UUID fields** use `z.string().uuid()`.

**ISO timestamp fields** use `z.string().datetime()` (UTC offset required by Zod's
`datetime()` default; the client store always produces ISO 8601 strings via
`new Date().toISOString()`).

**DB enum references:** `weight_unit` and `workout_status` enum values are typed against
`Database['public']['Enums']` from `lib/supabase/types.ts`. The local `as const satisfies`
assertions cause a compile-time failure if DB enum values are renamed, so schema drift is
caught at build time rather than at runtime.

**`status: 'expired'`** is intentionally excluded from `workoutPatchBodySchema`. That
transition is cron-only and must not be reachable from client requests.

**`setEditBodySchema`** requires at least one of `reps`, `weightValue`, or `weightUnit`
via `.refine()` — a body with only `clientMutationId` is rejected at 400.

## Usage

```ts
import { workoutCreateBodySchema } from '@/lib/schemas';

const result = workoutCreateBodySchema.safeParse(await request.json());
if (!result.success) {
  return jsonError(400, 'VALIDATION_ERROR', 'Invalid body', { issues: result.error.issues });
}
const body = result.data;
```

Inferred types are exported alongside each schema (`WorkoutCreateBody`, `SetLogBody`, etc.)
so route handlers can annotate local variables without re-deriving the type from
`z.infer<typeof …>`.
