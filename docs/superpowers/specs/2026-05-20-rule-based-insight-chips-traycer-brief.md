# Traycer Brief — T20a: Rule-Based Insight Chips

**Purpose:** machine-readable handoff for the Traycer agent. Use this
to create or update ticket T20a and to sync project documentation.
Full design lives in `2026-05-20-rule-based-insight-chips-design.md`
(same directory). This brief is the ticket-shaped summary.

---

## Ticket — T20a

**Title:** Richer rule-based insight chips (Progress Engine v2 surface)

**Replaces:** the chip-generation portion of original T20 (Phase 3 AI
summarization). T20 has been split: T20a (this ticket, rule-based,
ships first) and T20b (AI Q&A + programming chat, separate ticket,
ships later).

**Depends on:** T18 (Progress Engine — complete)

**Phase:** 3

### Scope

Upgrade the home-dashboard insight chips from generic, repetitive
messages to specific, ranked, tappable insights driven entirely by the
existing Progress Engine. No AI, no new DB queries, no schema changes.

### Included

- Two pure derivations added to `InsightsBundle`:
  - `personalRecords` (from `oneRepMaxSeries`)
  - `lastSeenByGroup` (from `allExerciseSamples`)
- Rewrite of `generateInsightMessages` to emit four rules with
  ranking and a cap of 4 chips on Home:
  - **PR** — new heaviest set or e1RM in the last 7 days
  - **Plateau + prescription** — upgrades existing plateau rule with
    actual weight/reps and a coaching line
  - **Neglected group** — muscle group not trained in ≥10 days
  - **Volume delta with numbers** — replaces "trending up" with
    `+18% vs last week (3,550 → 4,180 lb)`
- `InsightMessage` gains optional `href` and required `category` fields.
- `InsightsList` on Home renders `<Link>` chips when `href` set, with
  category icon and trailing arrow.
- Consistency-streak chip moves to `QuickStatsRow` to avoid duplication.

### Out of scope

- AI summaries or natural-language generation (T20b).
- Programming suggestions / next-session prescriptions.
- Schema changes, new DB queries, new Supabase migrations.
- Per-user threshold tuning.

### Files touched

```
features/insights/lib/types.ts                                  (edit)
features/insights/lib/messages.ts                               (rewrite)
features/insights/lib/personalRecords.ts                        (new)
features/insights/lib/lastSeen.ts                               (new)
features/insights/lib/__tests__/messages.test.ts                (extend)
features/insights/lib/__tests__/personalRecords.test.ts         (new)
features/insights/lib/__tests__/lastSeen.test.ts                (new)
lib/insights/server.ts                                          (edit)
features/home/components/InsightsList.tsx                       (edit)
```

No other files are expected to change.

### Acceptance criteria

- All four rules covered by unit tests with "fires" and "does not fire"
  cases.
- Home insights show specific numbers (weight, reps, %, lb) instead of
  generic momentum phrases.
- Chips with `href` are click- and keyboard-navigable, with visible
  hover state and trailing arrow.
- No more than 4 chips render on Home.
- Cold-start empty state (< 3 completed workouts) unchanged.
- No new DB queries; `insightsTag(userId)` cache invalidation continues
  to refresh chips after workout completion.

### Thresholds (fixed in this ticket)

| Threshold              | Value                | Notes                                    |
| ---------------------- | -------------------- | ---------------------------------------- |
| PR recency window      | 7 days               | Stale PRs do not surface                 |
| Neglected-group cutoff | 10 days              | Future: derive from user's avg frequency |
| Volume delta floor     | 500 lb               | Below this, no chip fires                |
| Plateau detection      | existing logic (T18) | Not changed                              |
| Max chips on Home      | 4                    | Hard cap                                 |

### Ranking order (when more than 4 candidates)

1. PRs (most recent first), max 2
2. Plateaus, max 1
3. Neglected groups (longest gap first), max 1
4. Volume deltas (largest \|pct\| first), fill remainder

### Risks

- **Low.** Pure functions, no schema or query changes. Worst case is a
  miscalibrated threshold that causes a chip to over- or under-fire;
  tunable in a one-line follow-up.

### Notes for Traycer

- Full design rationale, edge cases, and data-flow diagram are in the
  companion design doc (`*-design.md` in the same directory).
- The implementation plan will land as a third file in this directory
  once written (`*-implementation-plan.md`). Attach all three to the
  ticket.
- T20b will be brainstormed as a separate cycle and will produce its
  own design + brief + plan trio.
