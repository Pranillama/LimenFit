/**
 * Sliding-window rate limiter for the AI assistant route.
 *
 * CAVEAT — per-process / per-serverless-instance, not global per-user:
 * The default implementation stores timestamps in an in-memory Map. On Vercel
 * and similar serverless platforms, each cold-started function instance has
 * its own Map, so a single user routed across multiple warm instances can
 * effectively exceed the nominal 20/hour cap. This is accepted for current
 * scale because:
 *   (a) `lib/ai/costGuard.ts` enforces a durable, Postgres-backed daily
 *       token cap that acts as the real ceiling, and
 *   (b) traffic volume does not yet justify the operational cost of Redis.
 *
 * Swap path: `REDIS_URL` is already declared in `lib/env.ts`. When set, the
 * singleton export below should switch to a Redis-backed adapter using a
 * sorted-set sliding window (see TODO marker further down).
 */
import { assertServerOnly } from '@/lib/env';

assertServerOnly();

export interface RateLimiter {
  check(userId: string): Promise<{ allowed: boolean; retryAfterSeconds: number }>;
}

const WINDOW_MS = 60 * 60 * 1000;
const MAX_REQUESTS = 20;
const MAX_TRACKED_USERS = 10_000;

export class InMemorySlidingWindowLimiter implements RateLimiter {
  private readonly buckets = new Map<string, number[]>();

  async check(userId: string): Promise<{ allowed: boolean; retryAfterSeconds: number }> {
    const now = Date.now();
    const cutoff = now - WINDOW_MS;

    let timestamps = this.buckets.get(userId);
    if (timestamps) {
      // Drop entries outside the window, then move this user to the end (LRU bump).
      timestamps = timestamps.filter((t) => t > cutoff);
      this.buckets.delete(userId);
    } else {
      timestamps = [];
    }

    if (timestamps.length >= MAX_REQUESTS) {
      // Oldest timestamp leaves the window first.
      const oldest = timestamps[0] ?? now;
      const retryAfterMs = Math.max(0, oldest + WINDOW_MS - now);
      this.buckets.set(userId, timestamps);
      this.pruneIfNeeded();
      return { allowed: false, retryAfterSeconds: Math.ceil(retryAfterMs / 1000) };
    }

    timestamps.push(now);
    this.buckets.set(userId, timestamps);
    this.pruneIfNeeded();
    return { allowed: true, retryAfterSeconds: 0 };
  }

  private pruneIfNeeded(): void {
    if (this.buckets.size <= MAX_TRACKED_USERS) return;
    // Map iteration order is insertion order; oldest-touched entries first.
    const toEvict = this.buckets.size - MAX_TRACKED_USERS;
    let i = 0;
    for (const key of this.buckets.keys()) {
      if (i++ >= toEvict) break;
      this.buckets.delete(key);
    }
  }
}

// TODO(redis): Add a `RedisSortedSetLimiter implements RateLimiter` that
// reads `REDIS_URL` from `lib/env.ts` and implements a sliding window via
// ZADD/ZREMRANGEBYSCORE/ZCARD on a per-user sorted set. The singleton below
// should then select between the in-memory and Redis adapters based on
// whether `env.server.REDIS_URL` is set.
export const rateLimiter: RateLimiter = new InMemorySlidingWindowLimiter();
