# features/home

Home dashboard feature for authenticated users.

## Data flow

`buildHomeDashboardDTO` (lib/homeDashboardDTO.ts) fetches up to `LOOKBACK_DAYS` of completed/expired workouts via a Supabase server client in the page's async Server Component and shapes them into a `HomeDashboardDTO`. No client-side fetching occurs — the DTO is passed as a prop to `HomeDashboardView`.

## Today's Workout Card

`TodaysWorkoutCard` reconciles two sources of truth:

- **Server state** (`todayCompletions` from DTO): completed/expired workouts that ended today, used for the "completed" branch.
- **Client store** (`useActiveWorkoutStore`): the in-progress draft, used for the "active draft" branch. The store is Zustand + localStorage so it persists across tabs; the card waits for `hydrated` before rendering to avoid stale skeletons.

Priority: active draft > completed today > empty.

## Ticket surface

| Ticket  | Files                                            |
| ------- | ------------------------------------------------ |
| T6/T9   | workout store (selectors, useActiveWorkoutStore) |
| T10     | RecentActivityList → `/train/history/[id]`       |
| T11/T12 | "My Plans →" link → `/train/plans`               |
| T14     | this feature folder                              |
