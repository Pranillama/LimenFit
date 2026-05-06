# app/(app)/train/history/[id]

Workout detail page — implements Flow 6, step 3 of the LimenFit Phase 1 spec.

## Structure

```
app/(app)/train/history/[id]/
  page.tsx      — Server Component; validates UUID, fetches DTO, renders WorkoutDetailView
  loading.tsx   — Next.js streaming boundary; shows PageSkeleton while fetching
  README.md     — this file
```

## Route

`/train/history/:id` — `id` must be an RFC 4122 v4 UUID (validated via `UUID_RE` from
`@/lib/utils`). Invalid IDs and missing rows both call `notFound()`.

## Server fetch (page.tsx)

`page.tsx` is an `async` Server Component. It calls `createSupabaseServerClient` and
runs two queries (the second is conditional):

### Query 1 — workout detail

```sql
SELECT
  id, name, status, started_at, completed_at, expired_at,
  last_activity_at, plan_workout_id,
  workout_exercises (
    id, exercise_id, position,
    sets ( id, set_number, weight_value, weight_unit, reps )
  )
FROM workouts
WHERE id = :id
```

RLS restricts rows to the authenticated user — no explicit `user_id` filter needed.
Results sorted in JS by `workout_exercises.position` then `sets.set_number`.

### Query 2 — plan name (conditional)

Executed only when `plan_workout_id IS NOT NULL`:

```sql
SELECT name, plans!inner(name)
FROM plan_workouts
WHERE id = :plan_workout_id
```

`planName` in the DTO is set to `plans.name` (the parent plan name).

## DTO shape (`WorkoutDetailDTO`)

Exported from `features/workout/components/WorkoutDetailView.tsx`.

```ts
interface WorkoutDetailDTO {
  id: string;
  name: string | null;              // raw DB name; auto-named client-side if null/empty
  status: 'completed' | 'expired';
  started_at: string;               // ISO 8601
  completed_at: string | null;
  expired_at: string | null;
  last_activity_at: string;
  plan_workout_id: string | null;
  planName: string | null;          // resolved plan name, null if no plan
  exercises: Array<{
    id: string;
    exercise_id: string;
    position: number;
    sets: Array<{
      localId: string;              // = sets.id from DB; stable key for inline-edit phase
      set_number: number;
      weight_value: number | null;
      weight_unit: string | null;
      reps: number | null;
    }>;
  }>;
}
```

## Client rendering (WorkoutDetailView)

`features/workout/components/WorkoutDetailView.tsx` is a `'use client'` component that:

- Formats the workout header (name, date/time, duration).
- Shows a "From plan: …" line when `planName` is non-null.
- Shows an "Expired draft" callout when `status === 'expired'`.
- Renders each exercise with its logged sets in a compact table.
- Renders stub action buttons: **Repeat Workout**, **Delete**, and (for expired) **Restore**.
  Click handlers are `TODO` markers — wired in subsequent phases.

## Action wiring

| Button          | Status    | Handler |
|-----------------|-----------|---------|
| Repeat Workout  | wired     | `useStartWorkoutAction` with `buildRepeatIntent`; disabled when `status === 'expired'` |
| Restore Workout | wired     | `useRestoreWorkoutMutation`; only rendered when `status === 'expired'` |
| Delete          | wired     | `useDeleteWorkoutMutation`; navigates to `/train/history` on success |

When `status === 'expired'` the primary action slot shows **Restore Workout** instead of
**Repeat Workout**. Inline set editing is also disabled until the workout is restored.

## Restore flow (Flow 6, step 5)

Restore is handled by `useRestoreWorkoutMutation` (see
`features/workout/hooks/useRestoreWorkoutMutation.ts`). The full flow:

1. **Local pre-check** — before contacting the server, `runRestoreMutation` calls
   `selectHasActiveDraft(useActiveWorkoutStore.getState())`. If a local draft is already
   active it throws `RestoreConflictError` immediately without ever reaching the network.
2. `POST /api/workouts/:id/restore` with a fresh `clientMutationId`. The server also guards
   against concurrent active drafts, returning `422 ACTIVE_DRAFT_EXISTS` when one exists.
3. On success, fetch `'*, workout_exercises(*, sets(*))'` to obtain the restored snapshot.
4. Build a `ServerWorkoutSnapshot` with `meta.status = 'in_progress'` and all `serverId`s
   populated, then call `useStartWorkoutAction` with `source: 'history-restore'`.
5. `useStartWorkoutAction` re-checks for an active local draft (in-flight race guard) before
   hydrating the store. If one is present it returns `{ blocked: true }` without opening the
   resume dialog.

**Conflict handling** — the local pre-check (step 1), the server-side `422 ACTIVE_DRAFT_EXISTS`
(step 2), and the in-flight race guard (step 5) all display the same verbatim toast:
> "Finish or discard your current active workout before restoring this one."

Other errors (`404 NOT_FOUND`, `422 NOT_EXPIRED`) show a generic toast:
> "Could not restore this workout."

An inline spinner replaces the button label while `restoreWorkout.isPending` is true.

## Flow 6 reference

> Flow 6, Step 3: User taps a history row → lands on `/train/history/:id` showing the
>   full workout with each exercise and logged sets, plus action buttons.
> Flow 6, Step 5: User taps "Restore Workout" on an expired detail view → same restore
>   flow as the history list, ending with navigation to /train.
