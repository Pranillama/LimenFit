# Rule-Based Insight Chips — Design

**Date:** 2026-05-20
**Ticket:** T20a (replaces the chip portion of original T20 — Phase 3 AI summarization)
**Status:** Approved by user, ready for implementation plan
**Depends on:** T18 (Progress Engine — complete)

## Scope

Upgrade the home-dashboard insight chips from generic, repetitive messages
("Volume for X is trending up — great momentum") to specific, ranked,
tappable insights driven entirely by the existing Progress Engine. No AI,
no new DB queries, no new tables.

Out of scope: AI-generated summaries, conversational Q&A, programming
suggestions. Those are addressed in T20b.

## Motivation

The current `generateInsightMessages` covers only five rules (plateau,
streak, low frequency, volume up, volume down). On Home, three different
muscle groups render the same wording, which makes the chips read as
filler rather than insight. The Progress Engine already computes the
richer signals (e1RM series, top-set weight/reps, plateau flags, per-week
volume deltas, per-week workout counts) — the chip layer just isn't using
them.

## Architecture

Two pure-derived additions to `InsightsBundle` (no extra DB calls; all
data is already loaded by `fetchWorkoutRows`):

- `personalRecords: PersonalRecord[]` — derived from `oneRepMaxSeries`.
  Per exercise, flags whether the most recent session set a new high in
  either `topSetWeight` (at ≥ same reps as prior best) or `e1rm`, and
  carries the prior best for delta display.
- `lastSeenByGroup: Record<MuscleGroup, string>` — last `workoutDate` per
  muscle group, derived from `allExerciseSamples`.

`InsightMessage` gains two optional fields:

```ts
interface InsightMessage {
  id: string;
  severity: 'info' | 'positive' | 'warning';
  text: string;
  href?: string; // NEW — when present, chip renders as a Link
  category: // NEW — drives icon + ranking
    'pr' | 'plateau' | 'gap' | 'volume' | 'consistency';
}
```

Caching, invalidation, and the `insightsTag(userId)` tag are unchanged.

### Data flow

```
Workout completion
       │
       ▼
[Progress Engine]
       │
       ├─ fetchWorkoutRows  (existing — no change)
       │
       ├─ rowsToKernelInput (existing — no change)
       │
       ├─ computeOneRepMaxSeries     (existing)
       ├─ computeVolumeTrend          (existing)
       ├─ computeConsistencyScore     (existing)
       ├─ detectPlateaus              (existing)
       ├─ computeWorkoutsPerWeekSeries (existing)
       ├─ derivePersonalRecords       NEW
       └─ deriveLastSeenByGroup       NEW
       │
       ▼
generateInsightMessages(bundle, ctx)   (rewritten)
       │
       ▼
buildHomeInsightsDTO → HomeInsightsDTO.topMessages
       │
       ▼
<InsightsList />   (small edit to render Link + category icon)
```

## Rule set

### Rule A — PR

- **Trigger:** the most recent `OneRepMaxPoint` for an exercise sets a
  new high in either (a) `topSetWeight` at ≥ same reps as prior best, or
  (b) `e1rm`. AND the session's `workoutDate` is within the last 7 days.
- **Text:** `New PR · {exerciseName} — {topSetWeight}×{topSetReps} (e1RM {e1rm} {unit})`
- **Tap:** `/train/exercise/{exerciseId}`
- **Severity:** `positive`
- **Category:** `pr`

### Rule B — Plateau with prescription (upgrades existing)

- **Trigger:** existing `PlateauSignal.isPlateauing === true`. Pull the
  top set from the latest `OneRepMaxPoint` for that exercise to enrich
  the text.
- **Text:** `Plateau · {exerciseName} — stalled {sessionsAnalyzed} sessions at {weight}×{reps}. Try drop sets, pause reps, or a deload week.`
- **Tap:** `/train/exercise/{exerciseId}`
- **Severity:** `warning`
- **Category:** `plateau`

### Rule C — Neglected group

- **Trigger:** for a muscle group, `(now - lastSeenByGroup[group]) ≥ 10 days`
  AND the user has trained that group at least once within the lookback
  window (avoids pestering for groups they've never trained).
- **Text:** `Gap · {Group} — no {group} work in {N} days`
- **Tap:** `/train`
- **Severity:** `warning`
- **Category:** `gap`

### Rule D — Volume delta with numbers (upgrades existing)

- **Trigger:** existing `VolumeTrendPoint` with `direction: 'up' | 'down'`
  AND `|deltaVolume| ≥ 500 lb` AND `prevWeekVolume > 0`. (`prevWeekVolume`
  computed as `totalVolume - deltaVolume`.)
- **Text up:** `{Group} volume +{pct}% vs last week ({prev} → {curr} {unit})`
- **Text down:** `{Group} volume −{pct}% vs last week ({prev} → {curr} {unit}) — was this planned?`
- **Tap:** `/train`
- **Severity:** `positive` for up; `info` for down
- **Category:** `volume`

### Ranking & cap

Chips are emitted in priority order; the top 4 are surfaced on Home.

1. PRs (most recent first), max 2.
2. Plateaus, max 1.
3. Neglected groups (longest gap first), max 1.
4. Volume deltas, by `|pct|` descending, fill remaining slots.

The existing consistency-streak chip moves to `QuickStatsRow` only so it
isn't duplicated in the chip list.

## UI changes

Files edited (no new component files):

| File                                                              | Change                                                                                                                                       |
| ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `features/insights/lib/types.ts`                                  | Add `href`, `category` to `InsightMessage`; add `PersonalRecord` type; extend `InsightsBundle` with `personalRecords` and `lastSeenByGroup`. |
| `features/insights/lib/messages.ts`                               | Rewrite `generateInsightMessages` to emit the four new rules with ranking and cap.                                                           |
| `features/insights/lib/personalRecords.ts` _(new)_                | `derivePersonalRecords(oneRepMaxSeries)` pure helper.                                                                                        |
| `features/insights/lib/lastSeen.ts` _(new)_                       | `deriveLastSeenByGroup(samples)` pure helper.                                                                                                |
| `lib/insights/server.ts`                                          | Call the two new derivers inside `getInsightsBundle`; include results in the cached bundle.                                                  |
| `features/home/components/InsightsList.tsx`                       | Render `<Link>` when `href` is set; pick icon from `category`; add trailing `→` arrow on tappable chips; hover state.                        |
| `features/insights/lib/__tests__/messages.test.ts`                | New cases per rule (fires + does not fire) + snapshot of full output for a synthetic bundle covering all four categories.                    |
| `features/insights/lib/__tests__/personalRecords.test.ts` _(new)_ | Unit tests for PR derivation.                                                                                                                |
| `features/insights/lib/__tests__/lastSeen.test.ts` _(new)_        | Unit tests for last-seen derivation.                                                                                                         |

Icon map (lucide-react):

- `pr` → `Trophy`
- `plateau` → `PauseCircle`
- `gap` → `TrendingDown`
- `volume` (positive) → `TrendingUp`
- `volume` (info/down) → `Activity`
- `consistency` → existing icons (unchanged)

## Edge cases

- **Cold start** (< 3 completed workouts): existing `InsightsEmptyCard`
  remains; no chip rules fire.
- **Unit handling:** chip text uses the `WeightUnit` of the most recent
  set for that exercise. No mixed-unit chips. If a user has logged the
  same exercise in both kg and lb, we trust the latest entry.
- **PR tie-breaks:** if today's session ties the prior best on
  `weight × reps` but not e1RM, do not fire (avoids "PR!" spam on a
  user who repeats a top set across sessions).
- **Plateau + PR conflict:** if both fire for the same exercise (rare —
  would mean a PR after a plateau), keep the PR and drop the plateau
  (PR is the more useful, more recent signal).
- **Volume delta noise:** the `|deltaVolume| ≥ 500 lb` floor and
  `prevWeekVolume > 0` guard prevent firing on tiny week-1 increments.
- **Zero PRs / zero plateaus / zero gaps:** volume deltas fill the chip
  list; if no rules fire at all, render no chips (do not invent filler).

## Testing

All new logic lives in pure functions that take `InsightsBundle`-shaped
data and return `InsightMessage[]` or derived sub-shapes. No Supabase
required. Tests use synthetic samples.

Required coverage:

- Each rule: one "fires" case + one "does not fire" case.
- Ranking: a synthetic bundle that would emit 6+ chips → assert top 4 by
  the priority order.
- Cap: ≤ 4 messages always returned.
- Unit handling: kg vs lb on the same exercise.
- PR tie-break: same weight × reps as prior best, no e1RM gain → no fire.
- Cold start: bundle from a user with 2 completed workouts → empty
  message array.

## Acceptance criteria

- All four new/upgraded rules fire correctly for representative
  fixtures and are covered by unit tests.
- The home insights list shows specific numbers (weight, reps, %, lb)
  rather than generic momentum phrases.
- Chips with `href` are keyboard- and click-navigable, with a visible
  hover state and trailing arrow.
- No more than 4 chips render on Home at once.
- The cold-start empty state is unchanged.
- No new DB queries are introduced; the `insightsTag(userId)` cache
  invalidation continues to refresh chips after workout completion.

## Non-goals

- AI-generated text of any kind (covered in T20b).
- Programming suggestions / next-session prescriptions beyond the
  static plateau text.
- Per-user threshold tuning (the 7-day, 10-day, 500-lb thresholds are
  fixed in this ticket; tuning is a follow-up if needed).

## Open questions

None blocking. Two future considerations noted for later:

1. The 10-day "neglected" threshold could be derived from each user's
   average training frequency (e.g., 3× their typical rest gap). Cleaner,
   but more code. Deferred.
2. PR detection could be expanded to "rep PRs" (most reps ever at a
   given weight). Deferred.
