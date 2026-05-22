# app/api/ask

Streaming chat endpoint for the AI assistant. Implements a single `POST /api/ask` handler that returns a Server-Sent Events stream.

## Endpoint

| Method | Path       | Description                                                                |
| ------ | ---------- | -------------------------------------------------------------------------- |
| `POST` | `/api/ask` | Run one assistant turn; streams text deltas, tool calls, and a done marker |

The handler runs on `runtime = 'nodejs'` and is `force-dynamic`. It authenticates via `requireUser()`, rate-limits, checks the daily cost cap, builds a per-turn base context, and invokes `runAskTurn` from `lib/ai/gemini.ts`. The route writes an `ai_chat_logs` row and a token-usage rollup (`ai_usage_daily`) in the `finally` block — see `lib/ai/README.md`.

When `LIMENFIT_FEATURE_AI_ASSISTANT` is off, the route responds `404 NOT_FOUND` (the page does the same; the feature is fully gated by the flag).

---

## Request body

**Schema:** `askBodySchema` (`lib/schemas/ai.ts`)

```json
{
  "messages": [
    { "role": "user", "content": "What did I do this week?" },
    { "role": "assistant", "content": "You hit three sessions…" },
    { "role": "user", "content": "And last week?" }
  ]
}
```

- `messages` — 1 to 50 items, each `content` 1–8000 chars.
- The last message **must** have `role: "user"` — enforced by the schema.
- The server does not persist conversation state; the client re-sends the full transcript per turn (see `features/ask/README.md`).

---

## Successful response (`200 OK`)

```
Content-Type:  text/event-stream
Cache-Control: no-cache, no-transform
Connection:    keep-alive
X-Accel-Buffering: no
```

The body is a sequence of SSE frames. Frames without an `event:` line default to the unnamed event and carry a text delta. Each frame is terminated by `\n\n`.

### Event types

| Event       | Data payload                                  | When emitted                                                                                  |
| ----------- | --------------------------------------------- | --------------------------------------------------------------------------------------------- |
| _(default)_ | `{ "delta": "string" }`                       | Each text chunk produced by the model. Multiple frames per turn.                              |
| `tool_call` | `{ "name": "string", "args": { … } }`         | The model called one of the read-only tools. `args` is the **raw** function-call arguments object Gemini emitted — it is forwarded into the SSE frame _before_ validation runs. Argument validation happens inside `dispatchToolCall()`; failures are recovered by feeding a tool error back to the model as a `functionResponse`, not by aborting the stream. |
| `done`      | `{ "tokensIn": number, "tokensOut": number }` | Final usage totals for the turn. Always the last frame on success.                            |
| `error`     | `{ "code": "string", "message": "string" }`   | Mid-stream failure (Gemini unavailable, timeout, etc.). The stream then closes.               |

Example frames (one turn, one tool call, two text chunks):

```
event: tool_call
data: {"name":"get_recent_workouts","args":{"days":7}}

data: {"delta":"You completed "}

data: {"delta":"3 workouts this week."}

event: done
data: {"tokensIn":420,"tokensOut":58}
```

Tool errors observed inside `runAskTurn` are not forwarded as `error` events — the model loop sees the failed `functionResponse` and recovers in the next text turn. Only an unrecoverable infra failure produces an `error` event.

---

## Error envelopes (non-stream responses)

Pre-stream failures return a JSON error body shaped by `lib/api/responses.ts`:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable description",
    "details": { … }
  }
}
```

| Condition                          | Status | Code               | Notes                                                                    |
| ---------------------------------- | ------ | ------------------ | ------------------------------------------------------------------------ |
| Unauthenticated                    | `401`  | `UNAUTHORIZED`     | From `requireUser()`                                                     |
| Feature flag off                   | `404`  | `NOT_FOUND`        | `LIMENFIT_FEATURE_AI_ASSISTANT` is unset/false                           |
| Invalid body                       | `400`  | `VALIDATION_ERROR` | Zod issues in `details`                                                  |
| Sliding-window rate limit exceeded | `429`  | `RATE_LIMIT`       | `details.retryAfterSeconds`; `Retry-After` header set; 20 req/h per user |
| Daily token cap reached            | `429`  | `COST_CAP`         | `details.capResetAt` (ISO timestamp, next UTC midnight)                  |

In-stream failures emit a single `event: error` frame and close the stream — the connection still returned `200` with SSE headers because the error surfaced after streaming began:

| Code                 | When                                                         |
| -------------------- | ------------------------------------------------------------ |
| `GEMINI_UNAVAILABLE` | Gemini upstream error, retry exhausted, or request timed out |

The client (`useAskStream`) maps both `error` frames and pre-stream non-200s to a single user-facing banner ("Coach is offline right now…" / the 429 message). Aborts (client navigation away) are not surfaced as errors.

---

## Implementation notes

- **Order of guards:** auth → feature flag → schema → rate limit → cost cap → base context build → stream. Each guard is its own short-circuit return.
- **Bookkeeping:** `recordTokens()` and `logTurn()` run in `finally`, so they fire on success, error, and client abort. Errors inside them are logged and swallowed — they never block the response.
- **Cancellation:** the route forwards `request.signal` into `runAskTurn`; the Gemini SDK observes it and the loop unwinds cleanly. The `finally` block always writes an `ai_chat_logs` row for the aborted turn (with `status: 'error'`), but `recordTokens()` only runs when at least one of `tokensIn`/`tokensOut` is non-zero. Because token counts are populated by the `done` event, an abort that lands before `done` records the turn in the chat log with zero tokens and does **not** roll up into the user's daily cap.
- **No idempotency:** unlike the `/api/sets` family, this route is not wrapped in `withIdempotency` — every POST is treated as a fresh turn.

---

## Tests

- `route.test.ts` — unit-style coverage of guard branches (auth, flag, schema, rate limit, cost cap).
- `route.integration.test.ts` — full SSE round-trip with a mocked Gemini client; currently stands in for the deferred Playwright E2E.

---

## Related files

| File                    | Purpose                                                         |
| ----------------------- | --------------------------------------------------------------- |
| `lib/ai/gemini.ts`      | `runAskTurn`, error classes, tool-call loop                     |
| `lib/ai/tools.ts`       | Read-only tool registry + Zod schemas                           |
| `lib/ai/baseContext.ts` | Per-turn user/insights snapshot injected into the system prompt |
| `lib/ai/rateLimit.ts`   | In-memory sliding-window limiter                                |
| `lib/ai/costGuard.ts`   | Daily token cap (Postgres-backed)                               |
| `lib/ai/logging.ts`     | `logTurn` — writes to `ai_chat_logs`                            |
| `lib/schemas/ai.ts`     | `askBodySchema`                                                 |
