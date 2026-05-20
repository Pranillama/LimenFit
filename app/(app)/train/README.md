# app/(app)/train

Active training session page and per-exercise history views.

## Sub-routes

### `exercises/[id]`

Server-rendered detail page for a single exercise (`/train/exercises/<uuid>`). Shows:
- Est. 1RM trend chart (Recharts `LineChart`, `OneRepMaxTrendChart` component)
- Stats block: best e1RM, last e1RM, 30-day delta
- Last 5 completed sessions containing this exercise, linking to `/train/history/<workoutId>`

Auth: covered by the existing `middleware.ts` matcher (`/train/:path*`). No middleware changes needed.

**Exercise-picker deep link (deferred):** The plan considered adding a chevron/info action on each row in `features/exercise-picker` that navigates to the exercise detail page without triggering selection. This was intentionally skipped to avoid bloating the selection UX — the picker is a focused, tap-to-select surface and adding a secondary tap target adds visual noise and interaction complexity. The detail page is reachable from workout history instead.

Data: calls `getOneRepMaxSeriesForExercise(userId, exerciseId)` from `lib/insights` — cached per-user with a 1-hour TTL, invalidated on workout completion.

`page.tsx` is a server component that exports `Metadata` and renders `<TrainPageShell />`.

`TrainPageShell` (client) subscribes to the active workout store and branches on status:

- **No draft** (`meta === null`) — renders `StartWorkoutEmptyState`: a "Start Workout" button that opens `ExercisePicker`, plus History and Plans links.
- **In progress** (`meta.status === 'in_progress'`) — renders `ActiveWorkoutSession`: a sticky `ActiveWorkoutHeader` (title, elapsed timer, sync badge, cancel / End Workout) with a full-screen session area and the discard confirmation dialog.
- **Completed** (`completed_local` / `completed_synced`) — renders `EndWorkoutSummary`: a summary of the finished workout covering name, date, exercise list, set counts, duration, and per-exercise volume. No personal-record stats are currently shown. The summary is visible while the session is pending sync (`completed_local` — displays "Saved locally — finishing sync…"); once fully synced, `useCompletionCleanup` auto-clears the store entry. A manual "Done" button is also rendered in the `completed_synced` state in case auto-clear has not yet fired.
