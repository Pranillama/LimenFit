# app/(app)/train

Active training session page.

`page.tsx` is a server component that exports `Metadata` and renders `<TrainPageShell />`.

`TrainPageShell` (client) subscribes to the active workout store and branches on status:

- **No draft** (`meta === null`) — renders `StartWorkoutEmptyState`: a "Start Workout" button that opens `ExercisePicker`, plus History and Plans links.
- **In progress** (`meta.status === 'in_progress'`) — renders `ActiveWorkoutSession`: a sticky `ActiveWorkoutHeader` (title, elapsed timer, sync badge, cancel / End Workout) with a full-screen session area and the discard confirmation dialog.
- **Completed** (`completed_local` / `completed_synced`) — renders `EndWorkoutSummary`: a summary of the finished workout covering name, date, exercise list, set counts, duration, and per-exercise volume. No personal-record stats are currently shown. The summary is visible while the session is pending sync (`completed_local` — displays "Saved locally — finishing sync…"); once fully synced, `useCompletionCleanup` auto-clears the store entry. A manual "Done" button is also rendered in the `completed_synced` state in case auto-clear has not yet fired.
