# Conversational AI Assistant — Design

**Date:** 2026-05-20
**Ticket:** T20b (replaces the AI portion of original T20)
**Status:** Approved by user, ready for implementation plan
**Depends on:** T18 (Progress Engine — complete), T20a (richer chips — recommended ship-first so the assistant is scoped only to where AI is uniquely valuable)

## Scope

Build a server-side conversational AI assistant at `/ask` that lets
users (a) query their training history in natural language and
(b) get next-session programming suggestions grounded in their
actual recent loads. Powered by Gemini, accessed via tool calls
against read-only views of the user's data. AI never computes stats
and never mutates anything.

Out of scope: multi-week program generation, form analysis (T19),
persistent thread history, voice input, program editing/saving.

## Motivation

The original T20 scoped AI as a summarization layer that produced
prose like "great momentum on chest!" That use case is now covered
deterministically and more accurately by T20a (rule-based chips).

AI earns its place when it does what rules can't:

- Answer ad-hoc questions over the user's full history
  ("when did I last hit 225 on bench?", "how often did I squat in
  March?").
- Generate context-aware programming suggestions ("for bench
  tomorrow, try 5×3 at 195 — you've been stuck at 185×5 for three
  sessions").

T20b is scoped tightly to those two uses.

## Architecture

### Request flow

```
Browser (/ask page)
    │
    │ POST /api/ask
    │   { messages: [...], baseContextRequested: true }
    ▼
[Next.js API route — server only, runtime: 'edge' or 'nodejs']
    │
    │ 1. Auth check                (Supabase RLS user)
    │ 2. Rate-limit check          (per-user, sliding window)
    │ 3. Daily cost cap check      (per-user, token budget)
    │ 4. Build base context        (insights bundle + this week)
    │ 5. Load versioned prompt     (prompts/ask/system.v1.md)
    │ 6. Call Gemini with tools
    │
    ▼
[Gemini 2.5-flash, pinned]  ◄──┐
    │                           │
    │ Tool call?               │  Tool result (JSON)
    ▼                           │
[Server tool executor]──────────┘
    │  4 read-only tools, all RLS-scoped to caller
    │
    ▼  Final text response
[Stream tokens back to /ask via Server-Sent Events]
    │
    ▼
[Log row → ai_chat_logs]
```

### Key files

| File                                            | Purpose                                             | New / edit |
| ----------------------------------------------- | --------------------------------------------------- | ---------- |
| `app/(app)/ask/page.tsx`                        | Route shell, auth, layout                           | new        |
| `features/ask/components/ChatView.tsx`          | Message list, input, streaming render               | new        |
| `features/ask/components/SuggestedPrompts.tsx`  | Starter prompts grid                                | new        |
| `features/ask/components/ToolCallIndicator.tsx` | Inline "Looked up X…" chip                          | new        |
| `features/ask/lib/types.ts`                     | Client message types                                | new        |
| `features/ask/lib/useAskStream.ts`              | React Query / SSE hook                              | new        |
| `features/shell/...` (nav)                      | Add "Ask" entry                                     | edit       |
| `app/api/ask/route.ts`                          | POST handler                                        | new        |
| `lib/ai/gemini.ts`                              | Gemini client wrapper, retries, error mapping       | new        |
| `lib/ai/tools.ts`                               | Tool schemas + dispatcher                           | new        |
| `lib/ai/baseContext.ts`                         | Build per-turn base context (reuses InsightsBundle) | new        |
| `lib/ai/rateLimit.ts`                           | Per-user sliding window                             | new        |
| `lib/ai/costGuard.ts`                           | Per-user daily token cap                            | new        |
| `lib/ai/logging.ts`                             | Structured log writer                               | new        |
| `lib/ai/env.ts`                                 | API key, model pin, feature flag                    | new        |
| `prompts/ask/system.v1.md`                      | Versioned system prompt                             | new        |
| `prompts/ask/tools.v1.md`                       | Tool descriptions / few-shots                       | new        |
| `supabase/migrations/<ts>_ai_chat_logs.sql`     | New table                                           | new        |
| `supabase/migrations/<ts>_ai_usage_daily.sql`   | New table                                           | new        |

### Why `lib/ai/` and not `lib/insights/`

The tools wrap insights but are AI-specific concerns (schema for
Gemini, dispatcher, error mapping). Keeping them in `lib/ai/` makes
it clear: the Progress Engine has no dependency on AI; AI has a
read-only dependency on the Progress Engine.

### Streaming vs. batch

Streaming. Gemini Flash with one or two tool round-trips can sit at
2-5 seconds. Streaming the final text keeps perceived latency under
1 second after tool calls resolve. Use Server-Sent Events
(`text/event-stream`) — simpler than WebSockets and adequate for
unidirectional streaming.

## Tools

All four are **read-only** and **RLS-scoped** (the Supabase client
is created with the caller's auth, so RLS enforces user isolation).

### `get_exercise_history(exerciseId, days = 90)`

Fetch recent sets for one exercise. Used for next-session
suggestions and "show me my recent X" questions. Returns:

```ts
{
  exerciseId: string;
  exerciseName: string;
  sessions: Array<{
    workoutDate: string;
    sets: Array<{ weight: number; reps: number; unit: 'lbs' | 'kg' }>;
    e1rm: number;
    topSetWeight: number;
    topSetReps: number;
  }>;
}
```

Caps `days` at 365.

### `search_sets_by_criteria(filters)`

The "when did I last hit 225?" tool. Filters:

```ts
{
  exerciseId?: string;
  weightGte?: number;
  weightLte?: number;
  repsGte?: number;
  repsLte?: number;
  dateFrom?: string;     // ISO date
  dateTo?:   string;
  limit?:    number;     // default 10, max 50
}
```

Returns `Array<{ setId, exerciseName, weight, reps, unit, workoutDate }>`
in descending date order.

### `get_personal_records(exerciseId?)`

Returns PRs computed by T20a's `derivePersonalRecords` (e1RM and
top-set highs per exercise). Without `exerciseId`, returns all PRs.

### `get_recent_workouts(days = 14)`

Returns last N days of workouts with exercise names, set counts, and
duration. For "what did I do this week?" questions. Caps `days` at 60.

### Tools NOT in this ticket

No write tools (no `log_set`, `start_workout`, etc.). No
`get_volume_trend` (the base context already includes the latest
volume direction per group). Defer additions to a follow-up if real
questions land outside the four we shipped.

## Base context

Built per turn, ~400 tokens, derived from the cached
`InsightsBundle` (no extra DB hit):

```ts
{
  user: {
    unitPref: 'lbs' | 'kg',
    weeklyGoal: number,
  },
  currentWeek: {
    workoutCount: number,
    sessionsByGroup: Record<MuscleGroup, number>,
  },
  insights: {
    streakWeeks: number,
    activePlateaus: Array<{ exercise: string; sessions: number; weight: number; reps: number }>,
    recentPRs: Array<{ exercise: string; e1rm: number; date: string }>,
    gaps: Array<{ group: MuscleGroup; daysSince: number }>,
  },
}
```

The bundle is shared across turns within a request batch (cheap to
rebuild from the existing cache). It is **always sent**, so Gemini
always has minimal grounding even before any tool call.

## Prompt

System prompt lives at `prompts/ask/system.v1.md`. Imported as a
string in `lib/ai/gemini.ts`. Three sections:

1. **Role.** "You are a strength coach inside the LimenFit app.
   You answer questions about the user's training history and
   suggest next sessions based on what their Progress Engine has
   computed."
2. **Hard rules.**

- Never invent numbers. Use tool results or base context.
- If you don't know, say so — don't guess weights or dates.
- When suggesting weight/reps, ground in the user's actual
  recent loads (call `get_exercise_history` if base context
  doesn't show it).
- No medical or injury-risk claims beyond standard form notes.
- Keep responses under 150 words unless explicitly asked for
  more detail.
- Use the user's preferred unit (`lbs` or `kg`) from base
  context.

3. **Tool guidance.** When to call each tool, with one example
   question per tool.

Tool descriptions live separately at `prompts/ask/tools.v1.md` to
keep the system prompt scannable.

### Versioning

Filename suffix: `.v1.md`, `.v2.md`, etc. Bump the version on any
substantive change. Old versions stay in the repo for diff/rollback.
The active version is hardcoded in one place:

```ts
// lib/ai/gemini.ts
import systemPrompt from '@/prompts/ask/system.v1.md';
import toolsPrompt from '@/prompts/ask/tools.v1.md';
```

To switch versions, change the import. No runtime selection — keeps
things auditable.

## Safeguards

### Rate limit

20 requests per user per hour, sliding window.

- If Redis is configured (`REDIS_URL` env), use it.
- Otherwise: in-memory LRU keyed by user ID. Adequate for a small
  user base; revisit for scale.
- Over the limit: HTTP 429 with `Retry-After` header. UI shows:
  _"You're chatting fast — try again in a few minutes."_

### Cost cap

50,000 tokens per user per day (input + output combined). At
Gemini Flash pricing, that's roughly $0.05/user/day max.

- Stored in `ai_usage_daily(user_id, date, tokens_in, tokens_out)`.
- Upserted at the end of every turn with `tokens_in + tokens_out`.
- Checked at the start of each turn.
- Over the cap: HTTP 429 with a clear message. UI shows:
  _"You've reached today's chat limit. It resets at midnight UTC."_

### Graceful failure

The `/ask` page never breaks. Failure modes and what the user sees:

| Failure                      | User sees                                                                                                         |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Gemini unavailable / timeout | Inline error: _"Coach is offline right now — try again in a moment."_ Prompts + history stay visible.             |
| Tool call fails              | Gemini receives the error and recovers; user sees normal response (likely "I couldn't pull that data right now"). |
| Rate limit                   | 429 with friendly text + Retry-After.                                                                             |
| Cost cap                     | 429 with reset-time text.                                                                                         |
| Network error mid-stream     | Partial response stays with footer _"(connection lost, try again)."_                                              |
| User unauthenticated         | Page redirects to sign-in (existing middleware behavior).                                                         |

### Logging

Every turn writes one row to `ai_chat_logs`:

```sql
create table ai_chat_logs (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id),
  created_at    timestamptz not null default now(),
  prompt_hash   text not null,        -- sha256 of user message
  tool_calls    jsonb not null default '[]'::jsonb,
  tokens_in     integer not null,
  tokens_out    integer not null,
  latency_ms    integer not null,
  status        text not null         -- 'ok' | 'error' | 'rate_limit' | 'cost_cap'
);
-- RLS: user can read own rows; service role writes.
```

By default, **prompt text is not stored** — only the hash — to keep
this PII-light. An env var `LIMENFIT_AI_LOG_PROMPT_TEXT=1` enables
full text capture for early-rollout debugging; this should be off in
production once the assistant is stable.

## Database

Two new tables, both small.

### `ai_chat_logs` (see above)

### `ai_usage_daily`

```sql
create table ai_usage_daily (
  user_id     uuid not null references auth.users(id),
  date        date not null,
  tokens_in   integer not null default 0,
  tokens_out  integer not null default 0,
  primary key (user_id, date)
);
-- RLS: user reads own rows; service role upserts.
-- Indexed by (user_id, date) via the PK.
```

Migrations: two files in `supabase/migrations/`, timestamped per
existing convention.

## UI behavior

### `/ask` page states

**Empty (no messages):**

- Greeting line: _"Ask your coach"_
- Grid of 5-6 suggested prompts (cards)
- Input pinned to bottom
- No chat history visible

**Active chat:**

- Message list (user right, coach left)
- Tool-call indicator collapses inline when AI used a tool:
  _"🔍 Looked up bench history…"_
- Streaming dots while waiting
- Input pinned to bottom
- "New conversation" button in header clears session

**Failure:**

- Same chat surface, with an inline error message (red border,
  friendly text)
- Input stays usable so user can retry

### Suggested prompts (initial set)

1. _"What should I do for my next bench session?"_
2. _"When did I last hit my squat PR?"_
3. _"Suggest a substitute for deadlifts today."_
4. _"How's my training volume trending?"_
5. _"What muscle groups have I been skipping?"_
6. _"Plan a workout for tomorrow."_

These are static for now. Could be personalized later (e.g., swap
in the user's actual plateaued exercise).

## Acceptance criteria

- `/ask` route loads with suggested prompts when no messages yet.
- Sending a message hits `/api/ask` and streams a response.
- Gemini cannot mutate data (verified: no write tools registered;
  unit test asserts the tool registry contains only read tools).
- "When did I last hit 225 on bench?" answers correctly using
  `search_sets_by_criteria`.
- "What should I do for bench tomorrow?" returns a recommendation
  grounded in the user's last 3 bench sessions' actual loads.
- Rate limit and cost cap return 429 with user-friendly messages,
  never 500s.
- Gemini downtime shows the offline message; the rest of the app
  keeps working.
- All prompts are loaded from versioned files in `prompts/ask/`.
- E2E test (Playwright): suggested prompt → streamed response →
  follow-up question → tool-call indicator visible.
- All tool functions have unit tests covering happy path and the
  "user has no data for this exercise" empty case.

## Testing

- **Unit tests:** each tool function (happy path + empty case),
  base context builder, prompt loader, rate limit logic, cost
  guard logic, error mapping in `lib/ai/gemini.ts`.
- **Integration tests** (against a mocked Gemini): full request
  flow including a tool call and a non-tool response.
- **E2E test:** the one Playwright flow described in AC.

## Non-goals

- Persistent thread history (revisit if users ask for it).
- Multi-week program generation, program editing, program saving.
- Voice input or speech-to-text.
- Form analysis (T19).
- Conversation export.
- Per-user threshold/limit tuning UI (rate limits and cost cap are
  fixed in this ticket).
- Multi-modal input (images of plates, video, etc.).

## Open questions (deferred, not blocking)

1. Should the assistant be feature-flagged for gradual rollout?
   Suggested: yes, ship behind `LIMENFIT_FEATURE_AI_ASSISTANT=1`
   and enable per-user via a `profiles.ai_assistant_enabled` flag.
   Decide during planning.
2. Should the cost cap reset window be midnight UTC or the user's
   local midnight? UTC is simpler; local is nicer. Defaulting to
   UTC; revisit if confusing.
3. Suggested prompts: static this ticket, dynamic (personalized)
   later. Tracked as a follow-up.
