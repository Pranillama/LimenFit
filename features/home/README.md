# features/home

Home dashboard feature for authenticated users.

## Data flow

The page (`app/(app)/home/page.tsx`) is an async Server Component that runs two parallel fetches:

1. **`buildHomeDashboardDTO`** (`lib/homeDashboardDTO.ts`) — fetches up to `LOOKBACK_DAYS` (14) of completed workouts via Supabase and shapes them into a `HomeDashboardDTO`. Used by `TodaysWorkoutCard` and `RecentActivityList`.

2. **`getInsightsBundle`** (`lib/insights/server.ts`) — fetches up to `INSIGHTS_LOOKBACK_WEEKS` (26) of workout history, runs the compute kernel (1RM, volume trend, consistency, plateaus), and generates `InsightMessage[]`. Results are cached with `unstable_cache` under the `insights:<userId>` tag and revalidated on workout completion.

Both results are combined via **`buildHomeInsightsDTO`** (`lib/homeDashboardDTO.ts`) into a `HomeInsightsDTO` that is passed to `HomeDashboardView` as a prop. No client-side fetching occurs.

## Insights on the home screen

`HomeInsightsDTO` contains:

| Field                 | Source                                                                                                                                | Used by                        |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| `workoutsThisWeek`    | Computed server-side from `recentCompletions` + current week                                                                          | `QuickStatsRow`                |
| `consistency.message` | Derived from `ConsistencyScore` in the bundle                                                                                         | `QuickStatsRow`                |
| `topMessages`         | Top 3 `InsightMessage[]`, severity-prioritized (warning → positive → info)                                                            | `InsightsList`                 |
| `volumeDeltas`        | Latest volume trend per muscle group: `direction` + `deltaVolume` (numeric delta vs prior period, `null` when no prior period exists) | Reserved for chip row (future) |

### Source of truth

`lib/insights/server.ts` → `getInsightsBundle(userId)` is the canonical source. Never call the compute kernels directly from the home feature.

## Components

| Component            | Description                                                                                     |
| -------------------- | ----------------------------------------------------------------------------------------------- |
| `QuickStatsRow`      | 2-column grid — "Workouts This Week" + "Consistency" tile (server data, renders on first paint) |
| `InsightsList`       | Stacked cards for top 3 insight messages; shows empty state when `<3` workouts in lookback      |
| `TodaysWorkoutCard`  | Today's workout status; client-gated on `clientNow` + active workout store                      |
| `RecentActivityList` | Last 5 completed workouts                                                                       |
| `AnalyzeTeaserCard`  | Reserved for T19/T20b (untouched) — T20a does not affect this card                              |

## Today's Workout Card

`TodaysWorkoutCard` reconciles two sources of truth:

- **Server state** (`todayCompletions` from DTO): completed/expired workouts that ended today, used for the "completed" branch.
- **Client store** (`useActiveWorkoutStore`): the in-progress draft, used for the "active draft" branch. The store is Zustand + localStorage so it persists across tabs; the card waits for `hydrated` before rendering to avoid stale skeletons.

Priority: active draft > completed today > empty.

## Ticket surface

| Ticket  | Files                                                                                                                       |
| ------- | --------------------------------------------------------------------------------------------------------------------------- |
| T6/T9   | workout store (selectors, useActiveWorkoutStore)                                                                            |
| T10     | RecentActivityList → `/train/history/[id]`                                                                                  |
| T11/T12 | "My Plans →" link → `/train/plans`                                                                                          |
| T14     | this feature folder                                                                                                         |
| T17/T18 | insights pipeline → `lib/insights/server.ts`                                                                                |
| T20a    | `features/insights/lib/{messages,personalRecords,lastSeen}.ts` + `features/home/components/InsightsList.tsx` (richer chips) |
| T20b    | `features/ask/...` + `lib/ai/...` (assistant UI; out of scope for this feature folder, listed for cross-reference only)     |
