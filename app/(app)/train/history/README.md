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
- **Expired badge + Restore placeholder** — `status === 'expired'` rows show an "Expired"
  badge and a disabled Restore button; wiring is delivered in the restore phase.
- **Empty state** — muted copy when both the server list and local state are empty.

## Flow 6 reference

> Flow 6, Step 1: User taps "Workout History" on the Train tab empty state or the
>   Train tab header → lands on `/train/history`.
> Flow 6, Step 2: A list of past workouts (completed + expired) is displayed, each
>   row showing name, date, duration, exercise/set counts.
