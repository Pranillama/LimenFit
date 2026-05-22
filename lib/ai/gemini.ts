import type { SupabaseClient } from '@supabase/supabase-js';
import {
  GoogleGenAI,
  type Content,
  type FunctionCall,
  type GenerateContentResponse,
  type Part,
} from '@google/genai';

import { assertServerOnly } from '@/lib/env';
import type { Database } from '@/lib/supabase/types';
import { GEMINI_MODEL, requireGeminiApiKey } from './env';
import { SYSTEM_PROMPT, TOOLS_PROMPT } from './promptLoader';
import {
  READONLY_TOOL_DECLARATIONS,
  ToolNotFoundError,
  ToolValidationError,
  dispatchToolCall,
} from './tools';
import type { BaseContext } from './baseContext';

assertServerOnly();

export const MAX_TOOL_ROUNDS = 3;

// ---------------------------------------------------------------------------
// Error classes — route handler maps these to user-facing messages
// ---------------------------------------------------------------------------

export class GeminiUnavailableError extends Error {
  readonly cause?: unknown;
  constructor(message = 'Gemini is unavailable', cause?: unknown) {
    super(message);
    this.name = 'GeminiUnavailableError';
    this.cause = cause;
  }
}

export class GeminiTimeoutError extends Error {
  constructor(message = 'Gemini request timed out') {
    super(message);
    this.name = 'GeminiTimeoutError';
  }
}

export class GeminiToolLoopExceededError extends Error {
  constructor(rounds: number) {
    super(`Tool-call loop exceeded ${rounds} rounds`);
    this.name = 'GeminiToolLoopExceededError';
  }
}

// ---------------------------------------------------------------------------
// Client factory — exported so tests can inject a deterministic mock
// ---------------------------------------------------------------------------

export type GeminiClient = Pick<GoogleGenAI, 'models'>;

let geminiClient: GeminiClient | null = null;

export function createGeminiClient(): GeminiClient {
  return new GoogleGenAI({ apiKey: requireGeminiApiKey() });
}

function getClient(): GeminiClient {
  if (!geminiClient) geminiClient = createGeminiClient();
  return geminiClient;
}

/** Test-only: swap the module-scope client. */
export function __setGeminiClientForTests(client: GeminiClient | null): void {
  geminiClient = client;
}

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface AskMessage {
  role: 'user' | 'assistant';
  content: string;
}

export type StreamEvent =
  | { kind: 'text'; delta: string }
  | { kind: 'tool_call'; name: string; args: Record<string, unknown> }
  | { kind: 'tool_error'; name: string; message: string }
  | { kind: 'done'; tokensIn: number; tokensOut: number };

export interface RunAskTurnInput {
  messages: AskMessage[];
  baseContext: BaseContext;
  supabase: SupabaseClient<Database>;
  userId: string;
  signal?: AbortSignal;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function buildSystemInstruction(baseContext: BaseContext): string {
  return [
    SYSTEM_PROMPT.trim(),
    '',
    TOOLS_PROMPT.trim(),
    '',
    '## Per-turn context',
    JSON.stringify(baseContext),
  ].join('\n');
}

function messagesToContents(messages: AskMessage[]): Content[] {
  return messages.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));
}

function isRetryableError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const e = err as { status?: number; code?: number; name?: string };
  if (e.status && e.status >= 500 && e.status < 600) return true;
  if (e.code && e.code >= 500 && e.code < 600) return true;
  if (e.name === 'FetchError' || e.name === 'TypeError') return true;
  return false;
}

function classifyGeminiError(err: unknown): Error {
  if (err instanceof Error && err.name === 'AbortError') {
    return new GeminiTimeoutError(err.message);
  }
  if (!err || typeof err !== 'object') {
    return new GeminiUnavailableError('Unknown Gemini error', err);
  }
  const e = err as { status?: number; code?: number; message?: string };
  const status = e.status ?? e.code ?? 0;
  if (status >= 500 || status === 0) {
    return new GeminiUnavailableError(e.message ?? 'Gemini upstream error', err);
  }
  // 4xx — surface as-is (caller decides; usually a 502 to the user)
  return err instanceof Error ? err : new Error(String(err));
}

async function startStreamWithRetry(
  client: GeminiClient,
  args: Parameters<GeminiClient['models']['generateContentStream']>[0],
): Promise<AsyncGenerator<GenerateContentResponse>> {
  try {
    return await client.models.generateContentStream(args);
  } catch (err) {
    if (isRetryableError(err)) {
      await new Promise((r) => setTimeout(r, 250));
      try {
        return await client.models.generateContentStream(args);
      } catch (retryErr) {
        throw classifyGeminiError(retryErr);
      }
    }
    throw classifyGeminiError(err);
  }
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

export async function* runAskTurn(input: RunAskTurnInput): AsyncIterable<StreamEvent> {
  const { messages, baseContext, supabase, userId, signal } = input;
  const client = getClient();

  const systemInstruction = buildSystemInstruction(baseContext);
  const contents: Content[] = messagesToContents(messages);

  let tokensIn = 0;
  let tokensOut = 0;

  for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
    const stream = await startStreamWithRetry(client, {
      model: GEMINI_MODEL,
      contents,
      config: {
        systemInstruction,
        tools: [{ functionDeclarations: READONLY_TOOL_DECLARATIONS }],
        abortSignal: signal,
      },
    });

    const pendingCalls: FunctionCall[] = [];
    const modelParts: Part[] = [];
    // Gemini reports cumulative usage per chunk within a stream; track the
    // latest values and add them to turn totals after the stream finishes so
    // repeated chunks aren't double-counted.
    let streamPromptTokens = 0;
    let streamOutputTokens = 0;

    try {
      for await (const chunk of stream) {
        if (signal?.aborted) throw new GeminiTimeoutError('Request aborted');

        const candidate = chunk.candidates?.[0];
        const parts = candidate?.content?.parts ?? [];
        for (const part of parts) {
          if (typeof part.text === 'string' && part.text.length > 0) {
            modelParts.push({ text: part.text });
            yield { kind: 'text', delta: part.text };
          }
          if (part.functionCall) {
            pendingCalls.push(part.functionCall);
            modelParts.push({ functionCall: part.functionCall });
          }
        }

        if (chunk.usageMetadata) {
          streamPromptTokens = chunk.usageMetadata.promptTokenCount ?? streamPromptTokens;
          streamOutputTokens = chunk.usageMetadata.candidatesTokenCount ?? streamOutputTokens;
        }
      }
    } catch (err) {
      throw classifyGeminiError(err);
    }

    tokensIn += streamPromptTokens;
    tokensOut += streamOutputTokens;

    if (pendingCalls.length === 0) {
      yield { kind: 'done', tokensIn, tokensOut };
      return;
    }

    if (round === MAX_TOOL_ROUNDS) {
      throw new GeminiToolLoopExceededError(MAX_TOOL_ROUNDS);
    }

    // Echo the model's tool-call turn into the conversation
    contents.push({ role: 'model', parts: modelParts });

    // Dispatch each call and build the function_response parts
    const responseParts: Part[] = [];
    for (const call of pendingCalls) {
      const name = call.name ?? '';
      const args = (call.args ?? {}) as Record<string, unknown>;
      yield { kind: 'tool_call', name, args };

      try {
        const result = await dispatchToolCall(name, args, { supabase, userId });
        responseParts.push({
          functionResponse: {
            id: call.id,
            name,
            response: { output: result },
          },
        });
      } catch (err) {
        const message =
          err instanceof ToolNotFoundError || err instanceof ToolValidationError
            ? err.message
            : err instanceof Error
              ? err.message
              : 'Tool execution failed';
        yield { kind: 'tool_error', name, message };
        responseParts.push({
          functionResponse: {
            id: call.id,
            name,
            response: { error: message },
          },
        });
      }
    }

    contents.push({ role: 'user', parts: responseParts });
  }

  // Unreachable — loop either returns or throws above
  throw new GeminiToolLoopExceededError(MAX_TOOL_ROUNDS);
}
