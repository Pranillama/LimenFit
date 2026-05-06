# app/(app)/train/history

Workout history page — implements Flow 6, steps 1–2 of the LimenFit Phase 1 spec.

## Structure

```
app/(app)/train/history/
  page.tsx      — Server Component; fetches and shapes data, renders HistoryList
  loading.tsx   — Next.js streaming boundary; shows PageSkeleton while fetching
  README.md     — this file
```

## Server fetch (page.tsx)

`page.tsx` is an `async` Server Component. It calls `createSupabaseServerClient` and
queries `workouts` where `status IN ('completed', 'expired')`, ordered by `started_at DESC`.
RLS scopes results to the authenticated user — no explicit `user_id` filter needed.

The query joins:
- `workout_exercises(id, exercise_id, exercises(name), sets(id))` — used to compute
  `exerciseCount`, `setCount`, and the auto-generated workout name in a single round-trip.

For each row the server computes a plain `HistoryRowDTO`:

| Field           | Source                                                                              |
|-----------------|-------------------------------------------------------------------------------------|
| `name`          | `workouts.name` if non-empty; otherwise `autoNameWorkout` over unique exercise names |
| `durationLabel` | `formatDuration(started_at, completed_at)` or `formatDuration(started_at, expired_at)` |
| `exerciseCount` | Count of deduplicated `exercise_id`s in `workout_exercises`                         |
| `setCount`      | Total count of `sets` rows across all `workout_exercises`                           |
| `status`        | `'completed'` or `'expired'`                                                        |

The array of DTOs is passed as a prop to the `HistoryList` client component.

## Client overlay (HistoryList)

`features/workout/components/HistoryList.tsx` is a `'use client'` component responsible for:

- **Rendering rows** as tappable `next/link` cards to `/train/history/{workoutId}`.
- **Sync-pending badge** — shown on a row whose `id` matches the active-workout store's
  `meta.workoutId` when `meta.status === 'completed_local'`.
- **Synthetic top entry** — when the store has `status === 'completed_local'` but the
  `workoutId` is `null` or not yet present in the server list, a non-navigable "Sync pending"
  row is rendered at the top with the auto-name computed via `useExerciseLookup`.
- **Expired badge + Restore button** — `status === 'expired'` rows show an "Expired" badge
  and an active "Restore" button. Clicking it triggers `useRestoreWorkoutMutation` without
  navigating to the detail page. While the mutation is pending the button is replaced by an
  inline spinner; `disabled` is set on all restore buttons to prevent concurrent mutations.
- **Empty state** — muted copy when both the server list and local state are empty.

## Restore flow (Flow 6, step 5)

`useRestoreWorkoutMutation` (`features/workout/hooks/useRestoreWorkoutMutation.ts`) handles
the full restore lifecycle:

1. **Local conflict pre-check** — before any network request, `runRestoreMutation` calls
   `selectHasActiveDraft(useActiveWorkoutStore.getState())`. If a local draft is already
   active it throws `RestoreConflictError` immediately, showing the conflict toast without
   ever contacting the server. This prevents the server restore from flipping the workout
   to `in_progress` while a pending `workout.create` mutation in the offline queue could
   later bind unrelated exercises to the restored workout id.

2. **Server request** — `POST /api/workouts/:id/restore` with a fresh `clientMutationId`.
   The route flips the workout's `status` back to `in_progress` and guards against concurrent
   active drafts server-side, returning `422 ACTIVE_DRAFT_EXISTS` when one exists.

3. **In-flight race guard** — after a successful server response, the hook calls
   `useStartWorkoutAction` with `source: 'history-restore'`. That action short-circuits:
   if `selectHasActiveDraft` returns true at that moment (a draft appeared after the local
   pre-check but before the snapshot fetch) it returns
   `{ blocked: true, reason: 'active-draft-exists' }` without opening the resume dialog.

4. **Snapshot hydration** — on success (no local or server conflict), the hook fetches the
   full workout snapshot via `'*, workout_exercises(*, sets(*))'`, builds a
   `ServerWorkoutSnapshot` with all `serverId`s populated and `meta.status = 'in_progress'`,
   hydrates the active-workout store via `hydrateFromServer`, and navigates to `/train`.

5. **Conflict toast** — the local pre-check (step 1), the `422 ACTIVE_DRAFT_EXISTS` server
   response (step 2), and the post-success blocked result (step 3) all show the same verbatim
   message:
   > "Finish or discard your current active workout before restoring this one."

6. **Other errors** — `404 NOT_FOUND` and `422 NOT_EXPIRED` show a generic toast:
   > "Could not restore this workout."

**Offline queue** — restore is NOT routed through the offline queue. It requires a live
server round-trip to flip status and fetch a fresh snapshot, and would provide no benefit
from `client_mutation_id` replay beyond what `withIdempotency` already supplies. The
`WorkoutRestoreMutation` queue descriptor in `features/workout/store/types.ts` and
`features/workout/store/queue.ts` is reserved infrastructure and remains unused.

## Flow 6 reference

> Flow 6, Step 1: User taps "Workout History" on the Train tab empty state or the
>   Train tab header → lands on `/train/history`.
> Flow 6, Step 2: A list of past workouts (completed + expired) is displayed, each
>   row showing name, date, duration, exercise/set counts.
> Flow 6, Step 5: User taps "Restore" on an expired row → workout is restored on the
>   server, store is hydrated from the fresh snapshot, and the user is navigated to /train.
