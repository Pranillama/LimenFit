import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

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

import { InMemorySlidingWindowLimiter } from '@/lib/ai/rateLimit';

const USER_ID = 'user-rl-1';

describe('InMemorySlidingWindowLimiter', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-21T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('allows the first 20 hits and blocks the 21st with retryAfterSeconds > 0', async () => {
    const limiter = new InMemorySlidingWindowLimiter();

    for (let i = 0; i < 20; i++) {
      const r = await limiter.check(USER_ID);
      expect(r.allowed).toBe(true);
    }

    const blocked = await limiter.check(USER_ID);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });

  it('allows another hit after advancing 1 hour past the window', async () => {
    const limiter = new InMemorySlidingWindowLimiter();
    for (let i = 0; i < 20; i++) await limiter.check(USER_ID);
    expect((await limiter.check(USER_ID)).allowed).toBe(false);

    vi.advanceTimersByTime(60 * 60 * 1000 + 1);

    const after = await limiter.check(USER_ID);
    expect(after.allowed).toBe(true);
    expect(after.retryAfterSeconds).toBe(0);
  });
});

describe('rateLimit.ts file header', () => {
  it('documents the per-serverless-instance caveat', () => {
    const src = readFileSync(join(process.cwd(), 'lib/ai/rateLimit.ts'), 'utf8');
    expect(src).toMatch(/per-serverless-instance/);
  });
});
