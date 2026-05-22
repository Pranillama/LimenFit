import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createHash } from 'node:crypto';

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

vi.mock('@/lib/supabase/service-role', () => ({
  createSupabaseServiceRoleClient: vi.fn(),
}));

vi.mock('@/lib/ai/env', () => ({
  shouldLogPromptText: vi.fn().mockReturnValue(false),
}));

import { logTurn, sha256 } from '@/lib/ai/logging';
import { createSupabaseServiceRoleClient } from '@/lib/supabase/service-role';
import { shouldLogPromptText } from '@/lib/ai/env';

const USER_ID = 'user-log-1';
const PROMPT = 'How many sets did I do this week?';

function makeInsertSpy(result: { error: Error | null } = { error: null }): {
  insert: ReturnType<typeof vi.fn>;
  from: ReturnType<typeof vi.fn>;
} {
  const insert = vi.fn().mockResolvedValue(result);
  const from = vi.fn().mockReturnValue({ insert });
  vi.mocked(createSupabaseServiceRoleClient).mockReturnValue({ from } as any);
  return { insert, from };
}

describe('sha256', () => {
  it('matches node:crypto sha256 hex', () => {
    const expected = createHash('sha256').update(PROMPT).digest('hex');
    expect(sha256(PROMPT)).toBe(expected);
  });
});

describe('logTurn', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(shouldLogPromptText).mockReturnValue(false);
  });

  it('inserts prompt_hash and omits prompt_text by default', async () => {
    const { insert } = makeInsertSpy();

    await logTurn({
      userId: USER_ID,
      promptText: PROMPT,
      toolCalls: [],
      tokensIn: 10,
      tokensOut: 20,
      latencyMs: 100,
      status: 'ok',
    });

    expect(insert).toHaveBeenCalledTimes(1);
    const row = insert.mock.calls[0]![0];
    expect(row.prompt_hash).toBe(createHash('sha256').update(PROMPT).digest('hex'));
    expect(row.prompt_text).toBeUndefined();
    expect(row.user_id).toBe(USER_ID);
    expect(row.tokens_in).toBe(10);
    expect(row.tokens_out).toBe(20);
    expect(row.status).toBe('ok');
  });

  it('includes prompt_text when shouldLogPromptText() is true', async () => {
    vi.mocked(shouldLogPromptText).mockReturnValue(true);
    const { insert } = makeInsertSpy();

    await logTurn({
      userId: USER_ID,
      promptText: PROMPT,
      toolCalls: [],
      tokensIn: 0,
      tokensOut: 0,
      latencyMs: 1,
      status: 'ok',
    });

    const row = insert.mock.calls[0]![0];
    expect(row.prompt_text).toBe(PROMPT);
  });

  it('does not reject when insert returns an error (failures are swallowed)', async () => {
    makeInsertSpy({ error: new Error('insert failed') });
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(
      logTurn({
        userId: USER_ID,
        promptText: PROMPT,
        toolCalls: [],
        tokensIn: 0,
        tokensOut: 0,
        latencyMs: 1,
        status: 'ok',
      }),
    ).resolves.toBeUndefined();

    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('does not reject when the client itself throws (catch-all)', async () => {
    vi.mocked(createSupabaseServiceRoleClient).mockImplementation(() => {
      throw new Error('client init blew up');
    });
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(
      logTurn({
        userId: USER_ID,
        promptText: PROMPT,
        toolCalls: [],
        tokensIn: 0,
        tokensOut: 0,
        latencyMs: 1,
        status: 'ok',
      }),
    ).resolves.toBeUndefined();

    consoleSpy.mockRestore();
  });
});
