import { requireUser } from '@/lib/api/auth';
import { handleApiError, jsonError } from '@/lib/api/responses';
import { buildBaseContext } from '@/lib/ai/baseContext';
import { checkDailyBudget, recordTokens } from '@/lib/ai/costGuard';
import { isAiAssistantEnabled } from '@/lib/ai/env';
import {
  GeminiTimeoutError,
  GeminiUnavailableError,
  runAskTurn,
  type StreamEvent,
} from '@/lib/ai/gemini';
import { logTurn } from '@/lib/ai/logging';
import { rateLimiter } from '@/lib/ai/rateLimit';
import { askBodySchema } from '@/lib/schemas/ai';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SSE_HEADERS: HeadersInit = {
  'Content-Type': 'text/event-stream',
  'Cache-Control': 'no-cache, no-transform',
  'X-Accel-Buffering': 'no',
  Connection: 'keep-alive',
};

interface ToolCallRecord {
  name: string;
  args: Record<string, unknown>;
}

export async function POST(request: Request): Promise<Response> {
  let userId: string;
  let supabase: Awaited<ReturnType<typeof requireUser>>['supabase'];

  try {
    const auth = await requireUser();
    supabase = auth.supabase;
    userId = auth.user.id;

    if (!isAiAssistantEnabled()) {
      return jsonError(404, 'NOT_FOUND', 'Not found');
    }

    const body = askBodySchema.parse(await request.json());
    const { messages } = body;

    const limit = await rateLimiter.check(userId);
    if (!limit.allowed) {
      const res = jsonError(
        429,
        'RATE_LIMIT',
        "You're chatting fast — try again in a few minutes.",
        { retryAfterSeconds: limit.retryAfterSeconds },
      );
      res.headers.set('Retry-After', String(limit.retryAfterSeconds));
      return res;
    }

    const budget = await checkDailyBudget(userId);
    if (!budget.allowed) {
      return jsonError(
        429,
        'COST_CAP',
        "You've reached today's chat limit. It resets at midnight UTC.",
        { capResetAt: budget.capResetAt.toISOString() },
      );
    }

    const baseContext = await buildBaseContext(userId);
    const lastUserMessage = messages[messages.length - 1]!.content;
    const startedAt = Date.now();
    const capturedUserId = userId;
    const capturedSupabase = supabase;

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const encoder = new TextEncoder();
        const toolCalls: ToolCallRecord[] = [];
        let tokensIn = 0;
        let tokensOut = 0;
        let status: 'ok' | 'error' | 'aborted' = 'ok';
        const write = (chunk: string) => controller.enqueue(encoder.encode(chunk));

        try {
          for await (const event of runAskTurn({
            messages,
            baseContext,
            supabase: capturedSupabase,
            userId: capturedUserId,
            signal: request.signal,
          }) as AsyncIterable<StreamEvent>) {
            if (request.signal.aborted) {
              status = 'aborted';
              break;
            }

            if (event.kind === 'tool_call') {
              toolCalls.push({ name: event.name, args: event.args });
              write(
                `event: tool_call\ndata: ${JSON.stringify({
                  name: event.name,
                  args: event.args,
                })}\n\n`,
              );
            } else if (event.kind === 'text') {
              write(`data: ${JSON.stringify({ delta: event.delta })}\n\n`);
            } else if (event.kind === 'done') {
              tokensIn = event.tokensIn;
              tokensOut = event.tokensOut;
              write(
                `event: done\ndata: ${JSON.stringify({
                  tokensIn,
                  tokensOut,
                })}\n\n`,
              );
            }
            // tool_error events are swallowed; the model loop will surface them in the next text turn.
          }
        } catch (err) {
          if (request.signal.aborted) {
            status = 'aborted';
          } else if (err instanceof GeminiUnavailableError || err instanceof GeminiTimeoutError) {
            status = 'error';
            write(
              `event: error\ndata: ${JSON.stringify({
                code: 'GEMINI_UNAVAILABLE',
                message: 'Coach is offline right now — try again in a moment.',
              })}\n\n`,
            );
          } else {
            status = 'error';
            console.error('[api/ask] stream error', err);
            write(
              `event: error\ndata: ${JSON.stringify({
                code: 'GEMINI_UNAVAILABLE',
                message: 'Coach is offline right now — try again in a moment.',
              })}\n\n`,
            );
          }
        } finally {
          const latencyMs = Date.now() - startedAt;
          try {
            controller.close();
          } catch {
            // Already closed (e.g. client disconnect) — ignore.
          }

          if (tokensIn > 0 || tokensOut > 0) {
            try {
              await recordTokens(capturedUserId, tokensIn, tokensOut);
            } catch (err) {
              console.error('[api/ask] recordTokens failed', err);
            }
          }
          try {
            await logTurn({
              userId: capturedUserId,
              promptText: lastUserMessage,
              toolCalls,
              tokensIn,
              tokensOut,
              latencyMs,
              status: status === 'aborted' ? 'error' : status,
            });
          } catch (err) {
            console.error('[api/ask] logTurn failed', err);
          }
        }
      },
      cancel() {
        // Client disconnected — runAskTurn observes request.signal and unwinds.
      },
    });

    return new Response(stream, { headers: SSE_HEADERS });
  } catch (err) {
    return handleApiError(err);
  }
}
