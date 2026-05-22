import { createHash } from 'node:crypto';

import { assertServerOnly } from '@/lib/env';
import { createSupabaseServiceRoleClient } from '@/lib/supabase/service-role';
import type { Database } from '@/lib/supabase/types';
import { shouldLogPromptText } from './env';

assertServerOnly();

export function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

type ChatLogStatus = Database['public']['Tables']['ai_chat_logs']['Insert']['status'];

export interface LogTurnInput {
  userId: string;
  promptText: string;
  toolCalls: unknown;
  tokensIn: number;
  tokensOut: number;
  latencyMs: number;
  status: ChatLogStatus;
}

export async function logTurn(input: LogTurnInput): Promise<void> {
  try {
    const supabase = createSupabaseServiceRoleClient();
    const row: Database['public']['Tables']['ai_chat_logs']['Insert'] = {
      user_id: input.userId,
      prompt_hash: sha256(input.promptText),
      tool_calls: (input.toolCalls ??
        []) as Database['public']['Tables']['ai_chat_logs']['Insert']['tool_calls'],
      tokens_in: input.tokensIn,
      tokens_out: input.tokensOut,
      latency_ms: input.latencyMs,
      status: input.status,
    };
    if (shouldLogPromptText()) {
      row.prompt_text = input.promptText;
    }
    const { error } = await supabase.from('ai_chat_logs').insert(row);
    if (error) {
      console.error('logTurn: insert failed', error);
    }
  } catch (err) {
    console.error('logTurn: unexpected error', err);
  }
}
