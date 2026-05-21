# Tools

All four tools are read-only and scoped to the calling user by RLS. Prefer base context first; call a tool only when the question needs detail base context does not carry.

## `get_exercise_history(exerciseId, days = 90)`

Fetch recent sets for one exercise. Use for next-session suggestions and "show me my recent X" questions. `days` is capped at 365. Returns sessions in date order with per-set weight/reps/unit plus the session's e1RM and top set.

Example: _"What should I do for my next bench session?"_ — call with the bench `exerciseId` to ground a recommendation in the user's last few sessions' actual loads.

## `search_sets_by_criteria(filters)`

The "when did I last hit 225?" tool. Filters: `exerciseId`, `weightGte`, `weightLte`, `repsGte`, `repsLte`, `dateFrom`, `dateTo`, `limit` (default 10, max 50). Returns matching sets in descending date order.

Example: _"When did I last hit 225 on bench?"_ — call with the bench `exerciseId` and `weightGte: 225` to find the most recent qualifying set.

## `get_personal_records(exerciseId?)`

Returns PRs (e1RM and top-set highs per exercise). Omit `exerciseId` for all PRs, or pass one to scope to a single lift. Use when the user asks about records, bests, or recent breakthroughs.

Example: _"When did I last hit my squat PR?"_ — call with the squat `exerciseId` to return that lift's current PR and the date it was set.

## `get_recent_workouts(days = 14)`

Returns the last N days of workouts with exercise names, set counts, and duration. `days` is capped at 60. Use for "what did I do this week?" style questions.

Example: _"What did I do this week?"_ — call with `days: 7` to summarize the week's sessions.
