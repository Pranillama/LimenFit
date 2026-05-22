# features/ask

Conversational AI assistant — `/ask` page and the React layer that streams responses from `POST /api/ask`.

## File map

```
features/ask/
  components/
    ChatView.tsx              Top-level page UI: message list, input, "New conversation" reset
    SuggestedPrompts.tsx      Empty-state suggestion chips that submit a canned prompt on click
    ToolCallIndicator.tsx     Pill rendered when the assistant calls a tool; exports summarizeToolCall()
  lib/
    __tests__/                Vitest unit tests for the SSE stream reducer
    types.ts                  ChatMessage / ToolCallEvent / StreamEvent / UseAskStreamResult
    useAskStream.ts           Client hook: parses SSE frames, mutates message state, owns abort signal
  index.ts                    Barrel — re-exports ChatView
```

The page entry point `app/(app)/ask/page.tsx` is a Server Component that:

1. Calls `isAiAssistantEnabled()` (`lib/ai/env.ts`) and returns `notFound()` when the flag is off.
2. Resolves the Supabase session and redirects to `/` if unauthenticated.
3. Renders `<ChatView suggestedPrompts={SUGGESTED_PROMPTS} />` inside `PageContainer`.

`/ask` is gated by `middleware.ts` alongside `/home`, `/train`, and `/profile`. The bottom nav (`features/shell/MobileBottomNav.tsx`) and sidebar (`features/shell/AppSidebar.tsx`) both surface the entry.

## Data flow

```
ChatView ──submit──▶ useAskStream.send(text)
                       │
                       ▼
              fetch('/api/ask', { method: 'POST', body: { messages } })
                       │
                       ▼  text/event-stream
              parse SSE frames ──▶ append delta / record tool call / surface error
                       │
                       ▼
              setMessages(...) ──▶ ChatView re-renders
```

- The hook keeps a single in-flight `AbortController`. While `status === 'streaming'`, additional `send()` calls return immediately without starting a new request (and `ChatView` also disables the submit button), so there is no user-visible "resubmit-to-abort" path. The in-flight request is aborted only on `reset()` ("New conversation") or on hook unmount.
- Every `send()` posts the **full prior history** (user + assistant turns with content) plus the new user message. The server does not persist conversation state — see "Session-only memory contract" below.
- SSE frame → client handling (the route in `app/api/ask/route.ts` does not emit one frame per `StreamEvent.kind`):
  - Unnamed `data:` frames carry `{ delta }` (produced from `kind: 'text'`) and are appended to the current assistant message.
  - `event: tool_call` frames carry `{ name, args }` and are recorded as a `ToolCallEvent` pill on the assistant message.
  - `event: done` frames carry `{ tokensIn, tokensOut }` and are intentionally ignored by the client — token accounting is server-side only.
  - `event: error` frames carry `{ code, message }` and flip the hook into the `error` state, surfacing `message` in the banner. These frames are synthesized by the route handler, not by `runAskTurn()`.
  - `kind: 'tool_error'` is internal to `runAskTurn()`; the route swallows it and lets the model recover via the next `functionResponse` round, so it never reaches the client.

## Component responsibilities

| Component           | Responsibility                                                                                                  |
| ------------------- | --------------------------------------------------------------------------------------------------------------- |
| `ChatView`          | Layout, sticky input, autoscroll, error banner, "New conversation" reset                                        |
| `SuggestedPrompts`  | Grid of prompt chips shown only when `messages.length === 0`; submitting bypasses the textarea                  |
| `ToolCallIndicator` | Renders the per-tool pill; `summarizeToolCall(name, args)` produces the human label and is shared with the hook |
| `useAskStream`      | SSE parsing, message-list reducer, status state machine (`idle` → `streaming` → `idle` / `error`)               |

## Session-only memory contract

The assistant has **no server-side conversation persistence**.

- `messages` state lives only in the `useAskStream` hook (React state).
- The list resets on full page reload, on `<New conversation>`, and on hook unmount.
- Nothing is written to `localStorage`, `sessionStorage`, or Supabase from this feature.
- `ai_chat_logs` (see `supabase/README.md`) stores one row per turn for usage tracking — **not** for replay. The route only persists `prompt_hash`, tool calls, token counts, latency, and status. Raw `prompt_text` is stored **only** when `LIMENFIT_AI_LOG_PROMPT_TEXT=1`.
- The server therefore depends on the client re-sending the full transcript on every `POST /api/ask` (see `useAskStream.send`).

If/when durable history is added, it must be opt-in and live behind an explicit user setting — do not silently start writing transcripts to the database.

## Adding a new suggested prompt

1. Open `app/(app)/ask/page.tsx`.
2. Add a string to the `SUGGESTED_PROMPTS` array — order is the display order.
3. Keep the phrasing short (one line on mobile) and grounded in something a tool can answer; the model is instructed to refuse invented numbers.

No component or hook changes are required — `SuggestedPrompts` reads the array as a prop.

## Tests

- `features/ask/lib/__tests__/useAskStream.test.ts` — covers SSE frame parsing, delta accumulation, tool-call rendering, abort behaviour, and the 429 error envelope.
- `app/api/ask/route.integration.test.ts` — exercises the full route → SSE round-trip against a mocked Gemini client (see `app/api/ask/README.md`).

Playwright-level browser E2E is intentionally deferred to a future infrastructure ticket; the two tests above are the current AC coverage.
