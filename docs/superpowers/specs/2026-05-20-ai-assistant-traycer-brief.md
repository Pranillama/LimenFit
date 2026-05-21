# Traycer Brief — T20b: Conversational AI Assistant

**Date:** 2026-05-20
**Status:** Approved, ready for planning
**Replaces:** original T20 (Phase 3, AI summarization of computed stats)

Full design lives in `2026-05-20-ai-assistant-design.md` (same
directory). This brief is the ticket-shaped summary.

---

## Ticket — T20b

**Title:** Conversational AI assistant — `/ask` page (Gemini, tool calling, server-side)

**Replaces:** the AI portion of original T20. T20 has been split into
T20a (rule-based chips — already specced) and T20b (this ticket).

**Depends on:**

- T18 (Progress Engine — complete)
- T20a (richer chips — ship first so the assistant is scoped only to
  use cases AI is uniquely valuable for, not duplicating chip prose)

**Phase:** 3

### Scope

Build a server-side conversational AI assistant at `/ask` powered by
Gemini. Two use cases:

1. **Q&A over training history** — "when did I last hit 225 on bench?",
   "how many times did I squat in March?", "what's my PR on deadlift?"
2. **Next-session programming suggestions** — "what should I do for
   bench tomorrow?", "suggest a substitute for deadlifts today."

The assistant accesses data through four read-only tool functions
(RLS-scoped per user). AI never computes stats, never mutates
anything. Hard architectural rule retained from original T20.

### Included

- New `/ask` route + nav entry
- Streaming chat UI (Server-Sent Events)
- Suggested prompts on empty state (5-6 starter prompts)
- Session-only conversation memory (no DB threads)
- Gemini 2.5-flash integration, pinned model version
- Versioned prompt files at `prompts/ask/system.v1.md` and `tools.v1.md`
- Four read-only tools:
  - `get_exercise_history(exerciseId, days=90)`
  - `search_sets_by_criteria(filters)`
  - `get_personal_records(exerciseId?)`
  - `get_recent_workouts(days=14)`
- Per-turn base context (~400 tokens) built from the cached
  `InsightsBundle` (no extra DB hit)
- Rate limit: 20 requests / user / hour (Redis if configured,
  in-memory LRU otherwise)
- Cost cap: 50,000 tokens / user / day (input + output combined)
- Two new tables: `ai_chat_logs`, `ai_usage_daily` (both with RLS)
- Structured logging per turn (prompt hash, not text, by default)
- Graceful failure for: Gemini down, tool failure, rate limit,
  cost cap, network error mid-stream

### Out of scope

- Multi-week program generation, program editing, program saving
- Persistent thread history (sessions only)
- AI computing stats (architectural rule, never changing)
- Form analysis (T19)
- Voice / image / video input
- Per-user threshold tuning UI

### Files

```
app/(app)/ask/page.tsx                                       new
app/api/ask/route.ts                                         new
features/ask/components/ChatView.tsx                         new
features/ask/components/SuggestedPrompts.tsx                 new
features/ask/components/ToolCallIndicator.tsx                new
features/ask/lib/types.ts                                    new
features/ask/lib/useAskStream.ts                             new
features/shell/... (nav)                                     edit
lib/ai/gemini.ts                                             new
lib/ai/tools.ts                                              new
lib/ai/baseContext.ts                                        new
lib/ai/rateLimit.ts                                          new
lib/ai/costGuard.ts                                          new
lib/ai/logging.ts                                            new
lib/ai/env.ts                                                new
prompts/ask/system.v1.md                                     new
prompts/ask/tools.v1.md                                      new
supabase/migrations/<ts>_ai_chat_logs.sql                    new
supabase/migrations/<ts>_ai_usage_daily.sql                  new
```

### Acceptance criteria

- `/ask` route loads with suggested prompts when no messages yet.
- Sending a message hits `/api/ask` and streams a response via SSE.
- Gemini cannot mutate data (no write tools registered; unit test
  asserts read-only tool registry).
- "When did I last hit 225 on bench?" answers correctly using
  `search_sets_by_criteria`.
- "What should I do for bench tomorrow?" returns a recommendation
  grounded in the user's last 3 bench sessions' actual loads.
- Rate limit and cost cap return 429 with user-friendly messages,
  never 500s.
- Gemini downtime shows offline message; rest of app keeps working.
- All prompts loaded from versioned files in `prompts/ask/`.
- E2E Playwright test: suggested prompt → streamed response →
  follow-up → tool-call indicator visible.
- All tool functions have unit tests (happy path + empty case).

### Locked-in decisions

| Decision          | Choice                                                                   |
| ----------------- | ------------------------------------------------------------------------ |
| Programming scope | Next-session suggestions only (no multi-week programs)                   |
| Surface           | Dedicated `/ask` page in main nav                                        |
| Data access       | Tool calling + small base context                                        |
| Memory            | Session-only, no DB persistence                                          |
| Streaming         | Yes, SSE                                                                 |
| Model             | `gemini-2.5-flash`, pinned (no `*-latest`)                               |
| Prompt versioning | Filename suffix (`system.v1.md`); active version is the hardcoded import |
| Cost cap reset    | Midnight UTC (revisit if confusing)                                      |
| Logging           | Prompt hash by default; full text behind env var for early debugging     |

### Carried-forward rules from original T20

- Server-side only. API key never reaches the client.
- AI does not compute stats. All data flows through tool calls or
  base context, never through direct DB queries inside the prompt.
- Graceful failure. AI being down must not break the page.
- Rate limit is per-user, not per-IP.

### Risks

- **Cost runaway** if a user spams or a prompt bug causes loops.
  Mitigated by per-turn cost guard + daily cap + rate limit.
- **Hallucinated numbers.** Mitigated by hard prompt rules and by
  the fact that all numeric grounding comes from tool results or
  base context.
- **Latency.** Tool calls add 1-2 round trips. Streaming the final
  text mitigates perceived latency.

### Open questions (planning-time decisions)

1. **Feature flag?** Suggested yes — ship behind
   `LIMENFIT_FEATURE_AI_ASSISTANT=1` and a per-user
   `profiles.ai_assistant_enabled` flag for gradual rollout.
   Resolve during plan.
2. **Edge runtime vs. Node?** API route can run on either. Edge =
   lower latency for the user but limited Node APIs. Resolve during
   plan based on what `@google/generative-ai` SDK supports.

### Notes for Traycer

- **Action requested:**
  - Retire/rewrite the original T20 ticket.
  - Create T20a (already specced — see chip design + brief).
  - Create T20b per this brief.
  - Mark T20a as the recommended ship-first order.
- All three planning files in this directory are tracked in git as
  durable design history.
- Implementation plan will be produced separately (likely by
  Traycer itself given the user's workflow) and can be attached to
  this ticket.
