# lib/ai

Server-only AI assistant layer: Gemini client wrapper, read-only tool registry, prompt loader, rate limiter, daily cost guard, structured logging.

All modules call `assertServerOnly()` at import time. Importing any of them from a Client Component will throw.

## Architectural rule

> **The AI never computes and never mutates.**

The model is a thin coaching surface over read-only data. Concretely:

- All tools in `tools.ts` are **read-only Supabase queries** (or pure derivations of existing kernel output). There is no `POST`, `PATCH`, or `DELETE` tool — the registry physically has nowhere for one to live.
- All arithmetic (1RM estimates, volume, plateaus, PRs) is performed by the deterministic insights kernels under `features/insights/lib/` and `lib/insights/server.ts`. The model receives pre-computed numbers in base context or tool payloads and is instructed (`prompts/ask/system.v1.md`) to never invent values.
- The model can produce **suggestions** as text ("try 5×5 at 185 lbs next session") but cannot create or modify a workout, plan, set, or exercise. Any future write-path must go through an explicit user-confirmed UI action, not a tool call.

If a future feature needs the assistant to write, that's a new architectural decision — not a follow-on tweak to `tools.ts`.

---

## File map

```
lib/ai/
  __tests__/             Vitest unit tests for each module
  baseContext.ts         buildBaseContext(userId) — per-turn user + insights snapshot
  costGuard.ts           checkDailyBudget / recordTokens (Postgres-backed)
  env.ts                 Feature flag + API-key gating (GEMINI_MODEL constant)
  gemini.ts              runAskTurn() — tool-call loop, retry, error classification
  logging.ts             logTurn() — inserts ai_chat_logs rows (service role)
  promptLoader.ts        Reads prompts/ask/system.v1.md and tools.v1.md at module init
  rateLimit.ts           InMemorySlidingWindowLimiter (singleton `rateLimiter`)
  tools.ts               READONLY_TOOLS registry + dispatchToolCall()
```

The matching prompt files live at:

```
prompts/ask/
  system.v1.md     Role, hard rules, tool-use guidance
  tools.v1.md      Detailed per-tool descriptions + example questions
```

---

## How a turn flows

```
POST /api/ask
  └─ buildBaseContext(userId)          ← user prefs + this-week stats + plateaus + recent PRs + gaps
  └─ runAskTurn({ messages, baseContext, supabase, userId, signal })
       │
       └─ Gemini stream (round 0..MAX_TOOL_ROUNDS)
            ├─ text chunk             → yield { kind: 'text', delta }
            ├─ functionCall           → dispatchToolCall(name, args, ctx)
            │                            │ Zod-validates args
            │                            │ runs read-only handler against Supabase
            │                            └─ append functionResponse → next round
            └─ stream ends, no calls  → yield { kind: 'done', tokensIn, tokensOut }
```

`MAX_TOOL_ROUNDS = 3`. Exceeding it throws `GeminiToolLoopExceededError`.

---

## Adding a new read-only tool

All four edits live in `tools.ts` plus one prompt addition. Match the existing patterns — the registry is the source of truth and the route does not need to change.

1. **Zod schema** — define an argument schema next to the existing `getExerciseHistorySchema` / `searchSetsByCriteriaSchema` block. Keep limits tight (cap `days`, `limit`, etc.) — the model will pass whatever it likes.
2. **Handler** — write an `async function handleX(args, ctx): Promise<…Payload>` that uses `ctx.supabase` (user-scoped RLS client, **not** service-role) and `ctx.userId`. Return a plain, JSON-serializable shape. Never write.
3. **`FunctionDeclaration`** — add a Gemini-format JSON Schema entry to `TOOL_DECLARATIONS`. Use UPPERCASE Gemini types (`OBJECT`, `STRING`, `INTEGER`, `NUMBER`). Required args go in `required: [...]`; defaults are documented in `description` but enforced by the Zod schema, not the JSON Schema.
4. **Registry entry** — add the tool to `READONLY_TOOLS` and extend the `ToolName` union. `dispatchToolCall` and `READONLY_TOOL_DECLARATIONS` pick it up automatically.
5. **`prompts/ask/tools.v1.md`** — append a section with the same structure as the existing four (signature, one-line purpose, example question). The model relies on this file for tool-selection heuristics; do not rename or move it without bumping the prompt version.
6. **`features/ask/components/ToolCallIndicator.tsx`** — add a `case` to `summarizeToolCall` so the tool-call pill shows a human-readable label instead of the raw snake_case name.
7. **Tests** — add a case to `lib/ai/__tests__/tools.test.ts` for success, RLS isolation, and Zod rejection of bad args.

---

## Bumping the prompt version

System and tool prompts are content-addressed by filename and frozen by version.

1. Copy `prompts/ask/system.v1.md` to `prompts/ask/system.v2.md` (and likewise for `tools.v1.md` if it changes). Edit the new file — do **not** edit `v1` in place.
2. Update `lib/ai/promptLoader.ts` to read the new filename:
   ```ts
   export const SYSTEM_PROMPT = readFileSync(
     join(process.cwd(), 'prompts/ask/system.v2.md'),
     'utf8',
   );
   export const TOOLS_PROMPT = readFileSync(join(process.cwd(), 'prompts/ask/tools.v2.md'), 'utf8');
   ```
3. Leave the old `v1` files in the tree until at least one release has shipped on `v2` — they're the rollback path.
4. Mention the prompt bump in the PR description; `ai_chat_logs` does not currently record prompt version, so the only way to attribute a behaviour change is the deploy timestamp.

---

## Rate limiter caveat (in-memory)

`rateLimit.ts` ships an `InMemorySlidingWindowLimiter` (20 requests / hour / user). The header comment on the file is the source of truth; the important caveat to repeat here:

> **Per-process / per-serverless-instance, not global per-user.** Each cold-started Vercel function has its own `Map`, so a single user routed across multiple warm instances can effectively exceed the nominal 20/hour cap.

This is accepted because the **durable Postgres-backed daily cost guard** (`costGuard.ts`, `DAILY_TOKEN_CAP = 50_000`) is the real safety net at scale — it reads from `ai_usage_daily` (see `supabase/README.md`) and survives across instances. The in-memory limiter is a politeness layer for burst smoothing, not a hard ceiling.

### Plugging in a Redis-backed limiter

`REDIS_URL` is already declared in `lib/env.ts` (optional). To swap:

1. Implement a `RedisSortedSetLimiter implements RateLimiter` in `rateLimit.ts` next to the in-memory class. Use ZADD/ZREMRANGEBYSCORE/ZCARD on a per-user sorted set keyed by `ratelimit:ask:<userId>` and a 1-hour TTL.
2. Change the singleton export to select between adapters:
   ```ts
   export const rateLimiter: RateLimiter = env.server.REDIS_URL
     ? new RedisSortedSetLimiter(env.server.REDIS_URL)
     : new InMemorySlidingWindowLimiter();
   ```
3. No call-site changes — `app/api/ask/route.ts` only uses the `RateLimiter` interface.
4. Add an integration test that exercises the Redis adapter against a local Redis (or `ioredis-mock`).

The TODO marker at the bottom of `rateLimit.ts` mirrors this checklist.

---

## Tests

Each module under `lib/ai/` has a co-located `__tests__/` file. Notable shapes:

- `tools.test.ts` — every tool's handler against a mocked Supabase client; RLS isolation; Zod rejection paths.
- `gemini.test.ts` — tool-call loop with a fake `GoogleGenAI` (`__setGeminiClientForTests`); retry on 5xx; abort propagation.
- `rateLimit.test.ts` — sliding-window correctness, LRU eviction.
- `costGuard.test.ts` — budget check + `record_ai_tokens` RPC call.
- `baseContext.test.ts` — derivation of `currentWeek`, `activePlateaus`, `recentPRs`, `gaps`.
- `logging.test.ts` — `prompt_text` is only set when `LIMENFIT_AI_LOG_PROMPT_TEXT=1`; hash always written.

Browser-level E2E for the Ask flow is **intentionally deferred** to a future Playwright infrastructure ticket. The current acceptance coverage is the Vitest integration test [`app/api/ask/route.integration.test.ts`](../../app/api/ask/route.integration.test.ts), which exercises the full route → mocked Gemini → SSE → tool round-trip without a browser.
