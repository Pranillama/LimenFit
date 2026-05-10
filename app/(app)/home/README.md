# app/(app)/home

Home page for authenticated users (async Server Component).

## Page structure

1. **HomeGreeting** — time-based greeting ("Good morning / afternoon / evening") with today's date.
2. **TodaysWorkoutCard** — active draft → resume; completed today → summary + "Start another"; empty → "Start Workout" via exercise picker.
3. **My Plans →** — right-aligned link to `/train/plans`.
4. **QuickStatsRow** — workouts this week + unique days trained this week.
5. **RecentActivityList** — up to 5 most-recent completed/expired sessions, each linking to `/train/history/[id]`.
6. **AnalyzeTeaserCard** — static "AI Form Analysis — Coming soon" card (non-interactive).

Data is fetched server-side in `page.tsx` and passed to `HomeDashboardView` as a `HomeDashboardDTO`.
