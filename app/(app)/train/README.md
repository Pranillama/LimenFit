# app/(app)/train

Active training session page.

`page.tsx` is a server component that exports `Metadata` and renders `<TrainPageShell />`.

`TrainPageShell` (client) subscribes to the active workout store and branches on status:

- **No draft** (`meta === null`) — renders `StartWorkoutEmptyState`: a "Start Workout" button that opens `ExercisePicker`, plus History and Plans links.
- **In progress** (`meta.status === 'in_progress'`) — renders `ActiveWorkoutSession`: a sticky `ActiveWorkoutHeader` (title, elapsed timer, sync badge, cancel / End Workout) with a full-screen session area and the discard confirmation dialog.
- **Completed** (`completed_local` / `completed_synced`) — placeholder for the end-workout summary (wired in a later phase).
