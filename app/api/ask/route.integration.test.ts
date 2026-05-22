/**
 * End-to-end-style integration test for POST /api/ask.
 *
 * Replaces the originally-scoped Playwright AC. Browser-level interaction
 * (clicking a SuggestedPrompt, observing the ToolCallIndicator in the DOM) is
 * intentionally deferred to a future Playwright infrastructure ticket; the
 * React side is covered by features/ask/lib/__tests__/useAskStream.test.ts.
 *
 * This test exercises the full POST → mocked Gemini → SSE response stream →
 * tool-call round-trip without spinning up a browser.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/env', () => ({
  assertServerOnly: () => {},
  env: {
    server: {
      NODE_ENV: 'test',
      SUPABASE_SERVICE_ROLE_KEY: 'test',
      LIMENFIT_FEATURE_AI_ASSISTANT: true,
    },
    client: {
      NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon',
      NEXT_PUBLIC_SITE_URL: 'https://localhost',
    },
  },
}));

vi.mock('@/lib/ai/env', () => ({
  GEMINI_MODEL: 'gemini-2.5-flash',
  isAiAssistantEnabled: () => true,
  requireGeminiApiKey: () => 'test-key',
  shouldLogPromptText: () => false,
}));

vi.mock('@/lib/ai/promptLoader', () => ({
  SYSTEM_PROMPT: 'SYSTEM',
  TOOLS_PROMPT: 'TOOLS',
}));

// Avoid loading the real insights/server (which pulls next/cache etc.).
// get_recent_workouts — the only tool dispatched in this test — does not
// touch this module.
vi.mock('@/lib/insights/server', () => ({
  getInsightsBundle: vi.fn(),
  rowsToKernelInput: vi.fn(),
}));

vi.mock('@/lib/api/auth', () => ({
  requireUser: vi.fn(),
  ApiAuthError: class ApiAuthError extends Error {},
}));

vi.mock('@/lib/ai/baseContext', () => ({
  buildBaseContext: vi.fn().mockResolvedValue({
    user: { unitPref: 'lbs', weeklyGoal: 3 },
    currentWeek: { workoutCount: 0, sessionsByGroup: {} },
    insights: { streakWeeks: 0, activePlateaus: [], recentPRs: [], gaps: [] },
  }),
}));

vi.mock('@/lib/ai/rateLimit', () => ({
  rateLimiter: { check: vi.fn().mockResolvedValue({ allowed: true, retryAfterSeconds: 0 }) },
}));

vi.mock('@/lib/ai/costGuard', () => ({
  checkDailyBudget: vi.fn().mockResolvedValue({
    allowed: true,
    usedToday: 0,
    capResetAt: new Date('2026-05-22T00:00:00.000Z'),
  }),
  recordTokens: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/ai/logging', () => ({
  logTurn: vi.fn().mockResolvedValue(undefined),
}));

// Scripted async iterator emulating Gemini's streaming generator.
const { generateContentStreamMock } = vi.hoisted(() => ({
  generateContentStreamMock: vi.fn(),
}));
vi.mock('@google/genai', () => {
  class GoogleGenAI {
    models = { generateContentStream: generateContentStreamMock };
  }
  return { GoogleGenAI };
});

import { POST } from './route';
import { requireUser } from '@/lib/api/auth';
import { recordTokens } from '@/lib/ai/costGuard';
import { logTurn } from '@/lib/ai/logging';
import { __setGeminiClientForTests } from '@/lib/ai/gemini';

const TEST_USER_ID = 'user-int-1';
const STARTED_AT = '2026-05-19T09:00:00.000Z';

interface SseFrame {
  event: string;
  data: unknown;
}

function parseSse(body: string): SseFrame[] {
  return body
    .split('\n\n')
    .map((raw) => raw.trim())
    .filter((raw) => raw.length > 0)
    .map((raw) => {
      const lines = raw.split('\n');
      let event = 'message';
      const dataLines: string[] = [];
      for (const line of lines) {
        if (line.startsWith('event:')) event = line.slice(6).trim();
        else if (line.startsWith('data:')) dataLines.push(line.slice(5).trimStart());
      }
      const dataStr = dataLines.join('\n');
      let data: unknown = null;
      try {
        data = JSON.parse(dataStr);
      } catch {
        data = dataStr;
      }
      return { event, data };
    });
}

async function readBody(res: Response): Promise<string> {
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let out = '';
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    out += decoder.decode(value, { stream: true });
  }
  return out;
}

async function* fromArray<T>(items: T[]): AsyncGenerator<T> {
  for (const it of items) yield it;
}

function makeSupabaseWithRecentWorkoutFixture() {
  const fixture = [
    {
      id: 'wk-1',
      name: 'Push Day',
      started_at: STARTED_AT,
      completed_at: '2026-05-19T10:00:00.000Z',
      status: 'completed',
      workout_exercises: [
        {
          id: 'we-1',
          exercise_id: 'ex-bench',
          position: 0,
          exercises: { name: 'Bench Press' },
          sets: [{ id: 's1' }, { id: 's2' }, { id: 's3' }],
        },
      ],
    },
  ];
  const order = vi.fn().mockResolvedValue({ data: fixture, error: null });
  const gte = vi.fn().mockReturnValue({ order });
  const eq2 = vi.fn().mockReturnValue({ gte });
  const eq1 = vi.fn().mockReturnValue({ eq: eq2 });
  const select = vi.fn().mockReturnValue({ eq: eq1 });
  const from = vi.fn().mockReturnValue({ select });
  return {
    client: { from } as any,
    spies: { from, select, eq1, eq2, gte, order },
    fixture,
  };
}

describe('POST /api/ask — integration (mocked Gemini + real tool dispatch)', () => {
  let supabaseFixture: ReturnType<typeof makeSupabaseWithRecentWorkoutFixture>;

  beforeEach(() => {
    vi.clearAllMocks();
    __setGeminiClientForTests(null);
    generateContentStreamMock.mockReset();

    supabaseFixture = makeSupabaseWithRecentWorkoutFixture();
    vi.mocked(requireUser).mockResolvedValue({
      supabase: supabaseFixture.client,
      user: { id: TEST_USER_ID } as any,
    });
  });

  it('streams a tool_call frame, text deltas, and a done frame; records tokens and logs the turn', async () => {
    // Round 0 — Gemini emits a function_call for get_recent_workouts.
    // Round 1 — Gemini emits the natural-language reply plus usage metadata.
    generateContentStreamMock.mockResolvedValueOnce(
      fromArray([
        {
          candidates: [
            {
              content: {
                parts: [
                  { functionCall: { name: 'get_recent_workouts', args: { days: 7 } } },
                ],
              },
            },
          ],
        },
      ]),
    );
    generateContentStreamMock.mockResolvedValueOnce(
      fromArray([
        { candidates: [{ content: { parts: [{ text: 'You did ' }] } }] },
        { candidates: [{ content: { parts: [{ text: '3 workouts this week.' }] } }] },
        { usageMetadata: { promptTokenCount: 120, candidatesTokenCount: 25 } },
      ]),
    );

    const req = new Request('http://localhost/api/ask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{ role: 'user', content: 'How many workouts did I do this week?' }],
      }),
    });

    const res = await POST(req);

    // Response headers
    expect(res.headers.get('Content-Type')).toBe('text/event-stream');
    expect(res.headers.get('Cache-Control')).toBe('no-cache, no-transform');
    expect(res.headers.get('X-Accel-Buffering')).toBe('no');

    const body = await readBody(res);
    const frames = parseSse(body);

    // tool_call frame
    const toolCalls = frames.filter((f) => f.event === 'tool_call');
    expect(toolCalls.length).toBeGreaterThanOrEqual(1);
    const tcData = toolCalls[0]!.data as { name: string; args: Record<string, unknown> };
    expect(tcData.name).toBe('get_recent_workouts');
    expect(tcData.args).toEqual({ days: 7 });

    // Delta frames accumulate to the full reply.
    const deltaFrames = frames.filter(
      (f) => f.event === 'message' && (f.data as any)?.delta !== undefined,
    );
    expect(deltaFrames.length).toBeGreaterThan(0);
    const fullReply = deltaFrames.map((f) => (f.data as { delta: string }).delta).join('');
    expect(fullReply).toBe('You did 3 workouts this week.');

    // Final done frame with numeric token counts.
    const done = frames.find((f) => f.event === 'done');
    expect(done).toBeDefined();
    const doneData = done!.data as { tokensIn: number; tokensOut: number };
    expect(typeof doneData.tokensIn).toBe('number');
    expect(typeof doneData.tokensOut).toBe('number');
    expect(doneData.tokensIn).toBe(120);
    expect(doneData.tokensOut).toBe(25);

    // After the stream closes the route's finally{} still has microtasks to
    // flush before recordTokens/logTurn settle.
    await vi.waitFor(() => {
      expect(recordTokens).toHaveBeenCalledWith(TEST_USER_ID, 120, 25);
    });
    await vi.waitFor(() => {
      expect(logTurn).toHaveBeenCalledTimes(1);
    });

    const logCall = vi.mocked(logTurn).mock.calls[0]![0];
    expect(logCall.status).toBe('ok');
    expect(logCall.promptText).toBe('How many workouts did I do this week?');
    expect(Array.isArray(logCall.toolCalls)).toBe(true);
    const names = (logCall.toolCalls as Array<{ name: string }>).map((c) => c.name);
    expect(names).toContain('get_recent_workouts');

    // The real dispatcher must have hit the supabase query chain for
    // get_recent_workouts (workouts table, user/status filters, started_at
    // window, order by started_at descending).
    const { spies } = supabaseFixture;
    expect(spies.from).toHaveBeenCalledWith('workouts');
    expect(spies.eq1).toHaveBeenCalledWith('user_id', TEST_USER_ID);
    expect(spies.eq2).toHaveBeenCalledWith('status', 'completed');
    expect(spies.gte).toHaveBeenCalledWith('started_at', expect.any(String));
    expect(spies.order).toHaveBeenCalledWith('started_at', { ascending: false });

    // The second Gemini request must include a functionResponse for
    // get_recent_workouts whose response.output contains the fixture workout.
    const secondCallArg = generateContentStreamMock.mock.calls[1]![0] as {
      contents: Array<{ role: string; parts: Array<Record<string, unknown>> }>;
    };
    const allParts = secondCallArg.contents.flatMap((c) => c.parts);
    const fnResponsePart = allParts.find(
      (p) =>
        (p as { functionResponse?: { name?: string } }).functionResponse?.name ===
        'get_recent_workouts',
    ) as
      | {
          functionResponse: {
            name: string;
            response: { output: Array<{ id: string }> };
          };
        }
      | undefined;
    expect(fnResponsePart).toBeDefined();
    const output = fnResponsePart!.functionResponse.response.output;
    expect(Array.isArray(output)).toBe(true);
    expect(output.map((w) => w.id)).toContain('wk-1');

    // SSE frame order contract: first relevant frame is tool_call, one or more
    // default message delta frames follow, and the last frame is event: done.
    const firstRelevantIdx = frames.findIndex(
      (f) =>
        f.event === 'tool_call' ||
        (f.event === 'message' && (f.data as any)?.delta !== undefined),
    );
    expect(firstRelevantIdx).toBeGreaterThanOrEqual(0);
    expect(frames[firstRelevantIdx]!.event).toBe('tool_call');

    const firstDeltaIdx = frames.findIndex(
      (f) => f.event === 'message' && (f.data as any)?.delta !== undefined,
    );
    expect(firstDeltaIdx).toBeGreaterThan(firstRelevantIdx);

    expect(frames[frames.length - 1]!.event).toBe('done');
  });
});
