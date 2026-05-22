import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/env', () => ({
  assertServerOnly: () => {},
  env: {
    server: { NODE_ENV: 'test', SUPABASE_SERVICE_ROLE_KEY: 'test' },
    client: {
      NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon',
      NEXT_PUBLIC_SITE_URL: 'https://localhost',
    },
  },
}));

const { generateContentStreamMock } = vi.hoisted(() => ({
  generateContentStreamMock: vi.fn(),
}));

vi.mock('@google/genai', () => {
  class GoogleGenAI {
    models = { generateContentStream: generateContentStreamMock };
  }
  return { GoogleGenAI };
});

vi.mock('@/lib/ai/env', () => ({
  GEMINI_MODEL: 'gemini-2.5-flash',
  requireGeminiApiKey: () => 'test-key',
  shouldLogPromptText: () => false,
}));

vi.mock('@/lib/ai/promptLoader', () => ({
  SYSTEM_PROMPT: 'SYSTEM',
  TOOLS_PROMPT: 'TOOLS',
}));

vi.mock('@/lib/ai/tools', () => ({
  READONLY_TOOL_DECLARATIONS: [],
  ToolNotFoundError: class ToolNotFoundError extends Error {},
  ToolValidationError: class ToolValidationError extends Error {},
  dispatchToolCall: vi.fn(),
}));

import {
  GeminiToolLoopExceededError,
  GeminiUnavailableError,
  MAX_TOOL_ROUNDS,
  __setGeminiClientForTests,
  runAskTurn,
  type StreamEvent,
} from '@/lib/ai/gemini';
import { dispatchToolCall } from '@/lib/ai/tools';

async function* fromArray<T>(items: T[]): AsyncGenerator<T> {
  for (const it of items) yield it;
}

function textChunk(text: string, usage?: { promptTokenCount?: number; candidatesTokenCount?: number }) {
  return {
    candidates: [{ content: { parts: [{ text }] } }],
    ...(usage ? { usageMetadata: usage } : {}),
  };
}

function functionCallChunk(name: string, args: Record<string, unknown>) {
  return {
    candidates: [{ content: { parts: [{ functionCall: { name, args } }] } }],
  };
}

const baseInput = () => ({
  messages: [{ role: 'user' as const, content: 'hello' }],
  baseContext: {} as any,
  supabase: {} as any,
  userId: 'user-1',
});

async function collect(stream: AsyncIterable<StreamEvent>): Promise<StreamEvent[]> {
  const out: StreamEvent[] = [];
  for await (const ev of stream) out.push(ev);
  return out;
}

describe('runAskTurn', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    __setGeminiClientForTests(null);
  });

  it('streams text then done with usage tokens', async () => {
    generateContentStreamMock.mockResolvedValueOnce(
      fromArray([
        textChunk('Hello '),
        textChunk('world.', { promptTokenCount: 50, candidatesTokenCount: 10 }),
      ]),
    );

    const events = await collect(runAskTurn(baseInput()));

    expect(events[0]).toEqual({ kind: 'text', delta: 'Hello ' });
    expect(events[1]).toEqual({ kind: 'text', delta: 'world.' });
    const last = events[events.length - 1];
    expect(last).toEqual({ kind: 'done', tokensIn: 50, tokensOut: 10 });
  });

  it('classifies a transient 5xx (after retry) as GeminiUnavailableError', async () => {
    const err = Object.assign(new Error('upstream 503'), { status: 503 });
    generateContentStreamMock.mockRejectedValueOnce(err).mockRejectedValueOnce(err);

    await expect(collect(runAskTurn(baseInput()))).rejects.toBeInstanceOf(
      GeminiUnavailableError,
    );
    expect(generateContentStreamMock).toHaveBeenCalledTimes(2);
  });

  it('throws GeminiToolLoopExceededError when MAX_TOOL_ROUNDS is exceeded', async () => {
    vi.mocked(dispatchToolCall).mockResolvedValue({ ok: true });

    // Every round returns a function call → loop never settles.
    for (let i = 0; i <= MAX_TOOL_ROUNDS; i++) {
      generateContentStreamMock.mockResolvedValueOnce(
        fromArray([functionCallChunk('get_recent_workouts', { days: 7 })]),
      );
    }

    await expect(collect(runAskTurn(baseInput()))).rejects.toBeInstanceOf(
      GeminiToolLoopExceededError,
    );
  });

  it('dispatches one tool round then yields final text + done', async () => {
    generateContentStreamMock
      .mockResolvedValueOnce(
        fromArray([functionCallChunk('get_recent_workouts', { days: 7 })]),
      )
      .mockResolvedValueOnce(
        fromArray([
          textChunk('You did 3 workouts.', { promptTokenCount: 100, candidatesTokenCount: 8 }),
        ]),
      );

    vi.mocked(dispatchToolCall).mockResolvedValueOnce([
      { id: 'wk-1', name: 'Push' },
    ]);

    const events = await collect(runAskTurn(baseInput()));

    const toolCall = events.find((e) => e.kind === 'tool_call');
    expect(toolCall).toBeDefined();
    expect((toolCall as Extract<StreamEvent, { kind: 'tool_call' }>).name).toBe(
      'get_recent_workouts',
    );

    const done = events.find((e) => e.kind === 'done') as Extract<
      StreamEvent,
      { kind: 'done' }
    >;
    expect(done).toBeDefined();
    expect(done.tokensIn).toBe(100);
    expect(done.tokensOut).toBe(8);
  });
});
