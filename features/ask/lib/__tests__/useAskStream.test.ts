// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';

vi.mock('../../components/ToolCallIndicator', () => ({
  summarizeToolCall: (name: string) => `summary:${name}`,
}));

import { useAskStream } from '@/features/ask/lib/useAskStream';

function encodeFrames(frames: string[]): Uint8Array[] {
  return frames.map((f) => new TextEncoder().encode(f));
}

function makeReadableStream(chunks: Uint8Array[]): ReadableStream<Uint8Array> {
  let i = 0;
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      if (i < chunks.length) {
        controller.enqueue(chunks[i]!);
        i++;
      } else {
        controller.close();
      }
    },
  });
}

function mockFetchResponse(opts: {
  status?: number;
  body?: ReadableStream<Uint8Array> | null;
}): Response {
  return new Response(opts.body ?? null, {
    status: opts.status ?? 200,
    headers: { 'Content-Type': 'text/event-stream' },
  }) as Response;
}

const originalFetch = globalThis.fetch;

beforeEach(() => {
  vi.restoreAllMocks();
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe('useAskStream', () => {
  it('accumulates messages from tool_call, multiple deltas, and done frames', async () => {
    const frames = [
      `event: tool_call\ndata: ${JSON.stringify({ name: 'get_recent_workouts', args: { days: 7 } })}\n\n`,
      `data: ${JSON.stringify({ delta: 'You did ' })}\n\n`,
      `data: ${JSON.stringify({ delta: '3 workouts ' })}\n\n`,
      `data: ${JSON.stringify({ delta: 'this week.' })}\n\n`,
      `event: done\ndata: ${JSON.stringify({ tokensIn: 50, tokensOut: 10 })}\n\n`,
    ];
    const body = makeReadableStream(encodeFrames(frames));
    const fetchMock = vi.fn().mockResolvedValue(mockFetchResponse({ body }));
    globalThis.fetch = fetchMock as any;

    const { result } = renderHook(() => useAskStream());

    act(() => {
      result.current.send('How many workouts this week?');
    });

    await waitFor(() => {
      expect(result.current.status).toBe('idle');
    });

    expect(result.current.messages).toHaveLength(2);
    const [userMsg, assistantMsg] = result.current.messages;
    expect(userMsg!.role).toBe('user');
    expect(userMsg!.content).toBe('How many workouts this week?');
    expect(assistantMsg!.role).toBe('assistant');
    expect(assistantMsg!.content).toBe('You did 3 workouts this week.');
    expect(assistantMsg!.toolCalls).toHaveLength(1);
    expect(assistantMsg!.toolCalls![0]!.name).toBe('get_recent_workouts');
  });

  it('transitions status from idle → streaming → idle on success', async () => {
    let release!: () => void;
    const blocker = new Promise<void>((r) => {
      release = r;
    });

    const body = new ReadableStream<Uint8Array>({
      async start(controller) {
        await blocker;
        controller.enqueue(
          new TextEncoder().encode(
            `data: ${JSON.stringify({ delta: 'hi' })}\n\nevent: done\ndata: ${JSON.stringify({ tokensIn: 1, tokensOut: 1 })}\n\n`,
          ),
        );
        controller.close();
      },
    });
    globalThis.fetch = vi.fn().mockResolvedValue(mockFetchResponse({ body })) as any;

    const { result } = renderHook(() => useAskStream());
    expect(result.current.status).toBe('idle');

    act(() => {
      result.current.send('hi');
    });

    await waitFor(() => expect(result.current.status).toBe('streaming'));

    act(() => {
      release();
    });

    await waitFor(() => expect(result.current.status).toBe('idle'));
  });

  it('reset() clears messages, status, and aborts any in-flight request', async () => {
    // Build a body that never completes until the consumer aborts.
    const body = new ReadableStream<Uint8Array>({
      start() {
        // Intentionally do nothing — the consumer must abort.
      },
    });

    const abortPromise = new Promise<void>((resolve) => {
      globalThis.fetch = vi.fn().mockImplementation(async (_url: string, init: RequestInit) => {
        const signal = init.signal!;
        signal.addEventListener('abort', () => resolve());
        return mockFetchResponse({ body });
      }) as any;
    });

    const { result } = renderHook(() => useAskStream());

    act(() => {
      result.current.send('hello');
    });

    await waitFor(() => expect(result.current.status).toBe('streaming'));
    expect(result.current.messages).toHaveLength(2);

    act(() => {
      result.current.reset();
    });

    await abortPromise;

    expect(result.current.messages).toEqual([]);
    expect(result.current.status).toBe('idle');
    expect(result.current.error).toBeNull();
  });
});
