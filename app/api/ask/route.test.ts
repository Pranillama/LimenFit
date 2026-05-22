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

vi.mock('@/lib/api/auth', () => ({
  requireUser: vi.fn(),
  ApiAuthError: class ApiAuthError extends Error {
    constructor(message = 'Unauthorized') {
      super(message);
      this.name = 'ApiAuthError';
    }
  },
}));

vi.mock('@/lib/ai/env', () => ({
  isAiAssistantEnabled: vi.fn().mockReturnValue(true),
}));

vi.mock('@/lib/ai/rateLimit', () => ({
  rateLimiter: { check: vi.fn() },
}));

vi.mock('@/lib/ai/costGuard', () => ({
  checkDailyBudget: vi.fn(),
  recordTokens: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/ai/baseContext', () => ({
  buildBaseContext: vi.fn().mockResolvedValue({
    user: { unitPref: 'lbs', weeklyGoal: 3 },
    currentWeek: { workoutCount: 0, sessionsByGroup: {} },
    insights: { streakWeeks: 0, activePlateaus: [], recentPRs: [], gaps: [] },
  }),
}));

vi.mock('@/lib/ai/logging', () => ({
  logTurn: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/ai/gemini', () => ({
  runAskTurn: vi.fn(),
  GeminiUnavailableError: class GeminiUnavailableError extends Error {
    constructor(message = 'unavail') {
      super(message);
      this.name = 'GeminiUnavailableError';
    }
  },
  GeminiTimeoutError: class GeminiTimeoutError extends Error {
    constructor(message = 'timeout') {
      super(message);
      this.name = 'GeminiTimeoutError';
    }
  },
}));

import { POST } from './route';
import { requireUser, ApiAuthError } from '@/lib/api/auth';
import { isAiAssistantEnabled } from '@/lib/ai/env';
import { rateLimiter } from '@/lib/ai/rateLimit';
import { checkDailyBudget } from '@/lib/ai/costGuard';
import { runAskTurn, GeminiUnavailableError } from '@/lib/ai/gemini';

const USER_ID = 'user-route-1';

const okAuth = {
  supabase: {} as any,
  user: { id: USER_ID } as any,
};

const goodLimit = { allowed: true as const, retryAfterSeconds: 0 };
const goodBudget = {
  allowed: true as const,
  usedToday: 0,
  capResetAt: new Date('2026-05-22T00:00:00.000Z'),
};

function makeRequest(body: unknown = { messages: [{ role: 'user', content: 'hi' }] }): Request {
  return new Request('http://localhost/api/ask', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function* emptyGen() {
  yield { kind: 'done', tokensIn: 0, tokensOut: 0 } as const;
}

async function readSse(res: Response): Promise<string> {
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

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(isAiAssistantEnabled).mockReturnValue(true);
  vi.mocked(rateLimiter.check).mockResolvedValue(goodLimit);
  vi.mocked(checkDailyBudget).mockResolvedValue(goodBudget);
});

describe('POST /api/ask', () => {
  it('returns 401 when requireUser throws ApiAuthError', async () => {
    vi.mocked(requireUser).mockRejectedValueOnce(new ApiAuthError());

    const res = await POST(makeRequest());
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 404 when isAiAssistantEnabled() is false', async () => {
    vi.mocked(requireUser).mockResolvedValueOnce(okAuth);
    vi.mocked(isAiAssistantEnabled).mockReturnValueOnce(false);

    const res = await POST(makeRequest());
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error.code).toBe('NOT_FOUND');
  });

  it('returns 400 VALIDATION_ERROR when the body is malformed', async () => {
    vi.mocked(requireUser).mockResolvedValueOnce(okAuth);

    const res = await POST(makeRequest({ messages: [] }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 429 RATE_LIMIT with Retry-After header (never 500)', async () => {
    vi.mocked(requireUser).mockResolvedValueOnce(okAuth);
    vi.mocked(rateLimiter.check).mockResolvedValueOnce({
      allowed: false,
      retryAfterSeconds: 42,
    });

    const res = await POST(makeRequest());
    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBe('42');
    const json = await res.json();
    expect(json.error.code).toBe('RATE_LIMIT');
  });

  it('returns 429 COST_CAP (never 500)', async () => {
    vi.mocked(requireUser).mockResolvedValueOnce(okAuth);
    vi.mocked(checkDailyBudget).mockResolvedValueOnce({
      allowed: false,
      usedToday: 50_000,
      capResetAt: new Date('2026-05-22T00:00:00.000Z'),
    });

    const res = await POST(makeRequest());
    expect(res.status).toBe(429);
    const json = await res.json();
    expect(json.error.code).toBe('COST_CAP');
  });

  it('emits SSE error frame and closes cleanly when runAskTurn throws GeminiUnavailableError (status still 200)', async () => {
    vi.mocked(requireUser).mockResolvedValueOnce(okAuth);
    vi.mocked(runAskTurn).mockImplementation(
      // eslint-disable-next-line require-yield
      async function* () {
        throw new GeminiUnavailableError('boom');
      } as any,
    );

    const res = await POST(makeRequest());
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('text/event-stream');

    const body = await readSse(res);
    expect(body).toMatch(/event: error/);
    expect(body).toMatch(/GEMINI_UNAVAILABLE/);
  });

  it('on happy path streams done frame with token counts', async () => {
    vi.mocked(requireUser).mockResolvedValueOnce(okAuth);
    vi.mocked(runAskTurn).mockReturnValueOnce(emptyGen() as any);

    const res = await POST(makeRequest());
    const body = await readSse(res);
    expect(res.status).toBe(200);
    expect(body).toMatch(/event: done/);
    expect(body).toMatch(/"tokensIn":0/);
  });
});
