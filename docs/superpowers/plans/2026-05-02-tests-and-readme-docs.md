# Tests & README Documentation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add unit tests for `withIdempotency`, Zod schemas, and route handlers, then finalize all README documentation for the mutation API surface.

**Architecture:** Tests live in `__tests__/` subdirectories following the `queue.test.ts` pattern — hand-rolled `vi.fn()` mocks, no real DB. Route-handler tests mock `@/lib/api/auth` and `@/lib/idempotency/server` at the module boundary. READMEs are updated in-place.

**Tech Stack:** Vitest (`pnpm test` → `vitest run`), Zod (schema assertions), Next.js route handlers imported as plain async functions.

---

## File Map

| Action | Path |
|--------|------|
| Create | `lib/idempotency/__tests__/server.test.ts` |
| Create | `lib/schemas/__tests__/workout.test.ts` |
| Create | `lib/schemas/__tests__/workout-exercise.test.ts` |
| Create | `lib/schemas/__tests__/set.test.ts` |
| Modify | `app/api/workouts/route.test.ts` |
| Create | `app/api/workouts/[id]/restore/route.test.ts` |
| Create | `app/api/workout-exercises/route.test.ts` |
| Create | `app/api/sets/route.test.ts` |
| Modify | `app/api/sets/README.md` |
| Modify | `app/api/workout-exercises/README.md` |
| Modify | `lib/idempotency/README.md` |

---

## Task 1: `lib/idempotency/__tests__/server.test.ts`

Covers the four core deduplication behaviours of `withIdempotency`. The existing `server.test.ts` (sibling, not `__tests__/`) covers the `responseMetadata` contract — these tests cover the miss/hit/race/validation behaviours.

**Files:**
- Create: `lib/idempotency/__tests__/server.test.ts`

- [ ] **Step 1: Write the test file**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/env', () => ({ assertServerOnly: () => {} }));

import { withIdempotency, IdempotencyValidationError } from '../server';

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';
const USER_ID    = 'aaaa0000-e29b-41d4-a716-446655440000';
const RESOURCE_ID = 'bbbb0000-e29b-41d4-a716-446655440000';

/**
 * Builds a minimal Supabase mock for mutation_receipts.
 *
 * - existingReceipt: returned by the first .maybySingle() call (cache-miss check).
 *   Pass null to simulate a miss; pass a receipt object to simulate a hit.
 * - insertError: if provided, the .insert() resolves with this error.
 * - raceReceipt: returned by the second .maybySingle() call (race re-read after 23505).
 *
 * Design: all `from()` calls return the same { select, insert } shape.
 * `maybySingle` is a single vi.fn() that returns different values per call count,
 * allowing select→eq→eq→maybySingle to work for both the initial lookup and
 * the post-23505 re-read without a more complex routing layer.
 */
function makeMock({
  existingReceipt = null,
  insertError = null,
  raceReceipt = null,
}: {
  existingReceipt?: Record<string, unknown> | null;
  insertError?: { code: string } | null;
  raceReceipt?: Record<string, unknown> | null;
} = {}) {
  let lookupCallCount = 0;

  const maybySingle = vi.fn().mockImplementation(async () => {
    lookupCallCount++;
    if (lookupCallCount === 1) return { data: existingReceipt, error: null };
    return { data: raceReceipt, error: null };
  });

  const eqInner = vi.fn().mockReturnValue({ maybeSingle: maybySingle });
  const eqOuter = vi.fn().mockReturnValue({ eq: eqInner });
  const selectFn = vi.fn().mockReturnValue({ eq: eqOuter });
  const insertFn = vi.fn().mockResolvedValue({ error: insertError, data: null });

  const from = vi.fn().mockReturnValue({ select: selectFn, insert: insertFn });

  return { supabase: { from } as any, insertFn, maybySingle };
}

describe('withIdempotency', () => {
  // (a) Miss path — handler runs once, receipt inserted with correct columns
  it('runs handler exactly once on a cache miss and inserts a receipt with correct columns', async () => {
    const { supabase, insertFn } = makeMock();
    const handler = vi.fn().mockResolvedValue({
      resourceId: RESOURCE_ID,
      response: { id: RESOURCE_ID },
    });

    const result = await withIdempotency({
      supabase,
      userId: USER_ID,
      clientMutationId: VALID_UUID,
      mutationType: 'set.log',
      resourceType: 'sets',
      handler,
    });

    expect(handler).toHaveBeenCalledTimes(1);
    expect(result.replayed).toBe(false);
    expect(result.resourceId).toBe(RESOURCE_ID);
    expect(result.response).toEqual({ id: RESOURCE_ID });

    expect(insertFn).toHaveBeenCalledTimes(1);
    const [insertPayload] = insertFn.mock.calls[0];
    expect(insertPayload).toMatchObject({
      client_mutation_id: VALID_UUID,
      user_id: USER_ID,
      mutation_type: 'set.log',
      resource_type: 'sets',
      resource_id: RESOURCE_ID,
    });
  });

  // (b) Hit path — returns prior resource_id, handler not called
  it('returns the prior resource_id on a cache hit without calling the handler', async () => {
    const existingReceipt = {
      resource_id: RESOURCE_ID,
      mutation_type: 'set.log',
      response_metadata: null,
    };
    const { supabase, insertFn } = makeMock({ existingReceipt });
    const handler = vi.fn();

    const result = await withIdempotency({
      supabase,
      userId: USER_ID,
      clientMutationId: VALID_UUID,
      mutationType: 'set.log',
      resourceType: 'sets',
      handler,
    });

    expect(handler).not.toHaveBeenCalled();
    expect(insertFn).not.toHaveBeenCalled();
    expect(result.replayed).toBe(true);
    expect(result.resourceId).toBe(RESOURCE_ID);
    expect(result.response).toBeNull();
  });

  // (c) Unique-violation on insert → treated as a hit, returns race winner's resource_id
  it('treats a 23505 insert error as a replay and returns the race-winner receipt', async () => {
    const raceReceipt = {
      resource_id: RESOURCE_ID,
      mutation_type: 'set.log',
      response_metadata: null,
    };
    const { supabase, insertFn } = makeMock({
      insertError: { code: '23505' },
      raceReceipt,
    });
    const handler = vi.fn().mockResolvedValue({
      resourceId: RESOURCE_ID,
      response: { id: RESOURCE_ID },
    });

    const result = await withIdempotency({
      supabase,
      userId: USER_ID,
      clientMutationId: VALID_UUID,
      mutationType: 'set.log',
      resourceType: 'sets',
      handler,
    });

    expect(handler).toHaveBeenCalledTimes(1);
    expect(insertFn).toHaveBeenCalledTimes(1);
    expect(result.replayed).toBe(true);
    expect(result.resourceId).toBe(RESOURCE_ID);
    expect(result.response).toBeNull();
  });

  // (d) Invalid clientMutationId — rejects before any DB work
  it('throws IdempotencyValidationError for a non-UUID clientMutationId without touching the DB', async () => {
    const { supabase, insertFn, maybySingle } = makeMock();
    const handler = vi.fn();

    await expect(
      withIdempotency({
        supabase,
        userId: USER_ID,
        clientMutationId: 'not-a-uuid',
        mutationType: 'set.log',
        resourceType: 'sets',
        handler,
      }),
    ).rejects.toThrow(IdempotencyValidationError);

    expect(handler).not.toHaveBeenCalled();
    expect(insertFn).not.toHaveBeenCalled();
    expect(maybySingle).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify they pass**

```bash
npx vitest run lib/idempotency/__tests__/server.test.ts --reporter=verbose
```

Expected: 4 PASS

- [ ] **Step 3: Commit**

```bash
git add lib/idempotency/__tests__/server.test.ts
git commit -m "test(idempotency): miss path, hit path, 23505 race, invalid UUID"
```

---

## Task 2: `lib/schemas/__tests__/workout.test.ts`

**Files:**
- Create: `lib/schemas/__tests__/workout.test.ts`

- [ ] **Step 1: Write the test file**

```ts
import { describe, it, expect } from 'vitest';
import {
  workoutCreateBodySchema,
  workoutPatchBodySchema,
  workoutDiscardBodySchema,
  workoutRestoreBodySchema,
} from '../workout';

const UUID = '550e8400-e29b-41d4-a716-446655440000';
const ISO  = '2026-05-01T10:00:00.000Z';

describe('workoutCreateBodySchema', () => {
  it('parses a valid body', () => {
    const result = workoutCreateBodySchema.safeParse({
      clientMutationId: UUID,
      localId: UUID,
      name: 'Leg Day',
      planWorkoutId: null,
      originPlanWorkoutId: null,
      startedAt: ISO,
      lastActivityAt: ISO,
    });
    expect(result.success).toBe(true);
  });

  it('rejects a non-UUID clientMutationId', () => {
    const result = workoutCreateBodySchema.safeParse({
      clientMutationId: 'not-a-uuid',
      localId: UUID,
      name: null,
      planWorkoutId: null,
      originPlanWorkoutId: null,
      startedAt: ISO,
      lastActivityAt: ISO,
    });
    expect(result.success).toBe(false);
  });

  it('rejects a missing startedAt', () => {
    const result = workoutCreateBodySchema.safeParse({
      clientMutationId: UUID,
      localId: UUID,
      name: null,
      planWorkoutId: null,
      originPlanWorkoutId: null,
      lastActivityAt: ISO,
    });
    expect(result.success).toBe(false);
  });
});

describe('workoutPatchBodySchema', () => {
  it('parses a valid body with optional fields', () => {
    const result = workoutPatchBodySchema.safeParse({
      clientMutationId: UUID,
      name: 'Upper Body',
      status: 'completed',
      lastActivityAt: ISO,
    });
    expect(result.success).toBe(true);
  });

  it('parses a body with only clientMutationId (all optionals absent)', () => {
    const result = workoutPatchBodySchema.safeParse({ clientMutationId: UUID });
    expect(result.success).toBe(true);
  });

  it('rejects status: "expired" (cron-only transition)', () => {
    const result = workoutPatchBodySchema.safeParse({
      clientMutationId: UUID,
      status: 'expired',
    });
    expect(result.success).toBe(false);
  });

  it('rejects a non-UUID clientMutationId', () => {
    const result = workoutPatchBodySchema.safeParse({ clientMutationId: 'bad' });
    expect(result.success).toBe(false);
  });
});

describe('workoutDiscardBodySchema', () => {
  it('parses a valid body', () => {
    expect(workoutDiscardBodySchema.safeParse({ clientMutationId: UUID }).success).toBe(true);
  });

  it('rejects a non-UUID clientMutationId', () => {
    expect(workoutDiscardBodySchema.safeParse({ clientMutationId: 'x' }).success).toBe(false);
  });
});

describe('workoutRestoreBodySchema', () => {
  it('parses a valid body', () => {
    expect(workoutRestoreBodySchema.safeParse({ clientMutationId: UUID }).success).toBe(true);
  });

  it('rejects a non-UUID clientMutationId', () => {
    expect(workoutRestoreBodySchema.safeParse({ clientMutationId: 'x' }).success).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests**

```bash
npx vitest run lib/schemas/__tests__/workout.test.ts --reporter=verbose
```

Expected: 9 PASS

- [ ] **Step 3: Commit**

```bash
git add lib/schemas/__tests__/workout.test.ts
git commit -m "test(schemas): workout schema happy-path and rejection cases"
```

---

## Task 3: `lib/schemas/__tests__/workout-exercise.test.ts`

**Files:**
- Create: `lib/schemas/__tests__/workout-exercise.test.ts`

- [ ] **Step 1: Write the test file**

```ts
import { describe, it, expect } from 'vitest';
import {
  workoutExerciseAddBodySchema,
  workoutExerciseReorderBodySchema,
  workoutExerciseDeleteBodySchema,
} from '../workout-exercise';

const UUID = '550e8400-e29b-41d4-a716-446655440000';

describe('workoutExerciseAddBodySchema', () => {
  it('parses a valid body', () => {
    const result = workoutExerciseAddBodySchema.safeParse({
      clientMutationId: UUID,
      localId: UUID,
      workoutId: UUID,
      exerciseId: UUID,
      position: 0,
    });
    expect(result.success).toBe(true);
  });

  it('rejects a non-UUID clientMutationId', () => {
    const result = workoutExerciseAddBodySchema.safeParse({
      clientMutationId: 'bad',
      localId: UUID,
      workoutId: UUID,
      exerciseId: UUID,
      position: 0,
    });
    expect(result.success).toBe(false);
  });

  it('rejects a negative position', () => {
    const result = workoutExerciseAddBodySchema.safeParse({
      clientMutationId: UUID,
      localId: UUID,
      workoutId: UUID,
      exerciseId: UUID,
      position: -1,
    });
    expect(result.success).toBe(false);
  });

  it('rejects a non-integer position', () => {
    const result = workoutExerciseAddBodySchema.safeParse({
      clientMutationId: UUID,
      localId: UUID,
      workoutId: UUID,
      exerciseId: UUID,
      position: 1.5,
    });
    expect(result.success).toBe(false);
  });
});

describe('workoutExerciseReorderBodySchema', () => {
  it('parses a valid body', () => {
    const result = workoutExerciseReorderBodySchema.safeParse({
      clientMutationId: UUID,
      position: 2,
    });
    expect(result.success).toBe(true);
  });

  it('rejects a non-UUID clientMutationId', () => {
    expect(
      workoutExerciseReorderBodySchema.safeParse({ clientMutationId: 'x', position: 0 }).success,
    ).toBe(false);
  });
});

describe('workoutExerciseDeleteBodySchema', () => {
  it('parses a valid body', () => {
    expect(
      workoutExerciseDeleteBodySchema.safeParse({ clientMutationId: UUID }).success,
    ).toBe(true);
  });

  it('rejects a non-UUID clientMutationId', () => {
    expect(
      workoutExerciseDeleteBodySchema.safeParse({ clientMutationId: 'x' }).success,
    ).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests**

```bash
npx vitest run lib/schemas/__tests__/workout-exercise.test.ts --reporter=verbose
```

Expected: 7 PASS

- [ ] **Step 3: Commit**

```bash
git add lib/schemas/__tests__/workout-exercise.test.ts
git commit -m "test(schemas): workout-exercise schema happy-path and rejection cases"
```

---

## Task 4: `lib/schemas/__tests__/set.test.ts`

**Files:**
- Create: `lib/schemas/__tests__/set.test.ts`

- [ ] **Step 1: Write the test file**

```ts
import { describe, it, expect } from 'vitest';
import { setLogBodySchema, setEditBodySchema, setDeleteBodySchema } from '../set';

const UUID = '550e8400-e29b-41d4-a716-446655440000';
const ISO  = '2026-05-01T10:00:00.000Z';

describe('setLogBodySchema', () => {
  it('parses a valid body', () => {
    const result = setLogBodySchema.safeParse({
      clientMutationId: UUID,
      localId: UUID,
      workoutExerciseId: UUID,
      setNumber: 1,
      reps: 10,
      weightValue: 60.5,
      weightUnit: 'kg',
      loggedAt: ISO,
    });
    expect(result.success).toBe(true);
  });

  it('rejects a non-UUID clientMutationId', () => {
    const result = setLogBodySchema.safeParse({
      clientMutationId: 'bad',
      localId: UUID,
      workoutExerciseId: UUID,
      setNumber: 1,
      reps: 10,
      weightValue: 60,
      weightUnit: 'kg',
      loggedAt: ISO,
    });
    expect(result.success).toBe(false);
  });

  it('rejects setNumber < 1', () => {
    const result = setLogBodySchema.safeParse({
      clientMutationId: UUID,
      localId: UUID,
      workoutExerciseId: UUID,
      setNumber: 0,
      reps: 10,
      weightValue: 60,
      weightUnit: 'kg',
      loggedAt: ISO,
    });
    expect(result.success).toBe(false);
  });

  it('rejects an invalid weightUnit', () => {
    const result = setLogBodySchema.safeParse({
      clientMutationId: UUID,
      localId: UUID,
      workoutExerciseId: UUID,
      setNumber: 1,
      reps: 10,
      weightValue: 60,
      weightUnit: 'stone',
      loggedAt: ISO,
    });
    expect(result.success).toBe(false);
  });

  it('accepts weightUnit "lbs"', () => {
    const result = setLogBodySchema.safeParse({
      clientMutationId: UUID,
      localId: UUID,
      workoutExerciseId: UUID,
      setNumber: 1,
      reps: 10,
      weightValue: 135,
      weightUnit: 'lbs',
      loggedAt: ISO,
    });
    expect(result.success).toBe(true);
  });
});

describe('setEditBodySchema', () => {
  it('parses a valid body with reps only', () => {
    expect(setEditBodySchema.safeParse({ clientMutationId: UUID, reps: 12 }).success).toBe(true);
  });

  it('parses a valid body with all optional fields', () => {
    const result = setEditBodySchema.safeParse({
      clientMutationId: UUID,
      reps: 12,
      weightValue: 70,
      weightUnit: 'kg',
    });
    expect(result.success).toBe(true);
  });

  it('rejects a body with only clientMutationId (no edit field provided)', () => {
    const result = setEditBodySchema.safeParse({ clientMutationId: UUID });
    expect(result.success).toBe(false);
  });

  it('rejects a non-UUID clientMutationId', () => {
    expect(setEditBodySchema.safeParse({ clientMutationId: 'x', reps: 5 }).success).toBe(false);
  });
});

describe('setDeleteBodySchema', () => {
  it('parses a valid body', () => {
    expect(setDeleteBodySchema.safeParse({ clientMutationId: UUID }).success).toBe(true);
  });

  it('rejects a non-UUID clientMutationId', () => {
    expect(setDeleteBodySchema.safeParse({ clientMutationId: 'x' }).success).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests**

```bash
npx vitest run lib/schemas/__tests__/set.test.ts --reporter=verbose
```

Expected: 9 PASS

- [ ] **Step 3: Commit**

```bash
git add lib/schemas/__tests__/set.test.ts
git commit -m "test(schemas): set schema happy-path and rejection cases"
```

---

## Task 5: Add 401 + 400 cases to `app/api/workouts/route.test.ts`

The existing file mocks `@/lib/api/auth` and `@/lib/idempotency/server` and covers four idempotency scenarios. Add two missing cases: unauthenticated requests and Zod validation failures.

**Files:**
- Modify: `app/api/workouts/route.test.ts`

- [ ] **Step 1: Read the existing file first** (already done above, but confirm line count)

The existing describe block ends at line 215. Append two new `describe` blocks before the closing of the outer file.

- [ ] **Step 2: Add the 401 and 400 test cases**

Add the following at the end of `app/api/workouts/route.test.ts`, before the final closing brace/EOF:

```ts
describe('POST /api/workouts — auth and validation errors', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when requireUser throws ApiAuthError', async () => {
    const { ApiAuthError } = await import('@/lib/api/auth');
    mockRequireUser.mockRejectedValueOnce(new ApiAuthError());

    const res = await POST(makeRequest());

    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 400 VALIDATION_ERROR when body fails schema validation', async () => {
    mockRequireUser.mockResolvedValueOnce({
      supabase: makeSupabase(null) as any,
      user: { id: USER_ID } as any,
    });

    const req = new Request('http://localhost/api/workouts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientMutationId: 'not-a-uuid' }),
    });

    const res = await POST(req);

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error.code).toBe('VALIDATION_ERROR');
    expect(mockWithIdempotency).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: Run tests**

```bash
npx vitest run app/api/workouts/route.test.ts --reporter=verbose
```

Expected: 6 PASS (4 existing + 2 new)

- [ ] **Step 4: Commit**

```bash
git add app/api/workouts/route.test.ts
git commit -m "test(routes/workouts): add 401 and 400 validation cases"
```

---

## Task 6: `app/api/workouts/[id]/restore/route.test.ts`

Tests the `ACTIVE_DRAFT_EXISTS` 422 branch. To exercise the inner handler logic, `withIdempotency` is mocked to call through to `opts.handler()`.

**Files:**
- Create: `app/api/workouts/[id]/restore/route.test.ts`

- [ ] **Step 1: Write the test file**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/api/auth', () => ({
  requireUser: vi.fn(),
  ApiAuthError: class ApiAuthError extends Error {
    constructor(message = 'Unauthorized') {
      super(message);
      this.name = 'ApiAuthError';
    }
  },
}));

vi.mock('@/lib/idempotency/server', () => ({
  withIdempotency: vi.fn(),
  IdempotencyValidationError: class IdempotencyValidationError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'IdempotencyValidationError';
    }
  },
}));

import { POST } from './route';
import { requireUser } from '@/lib/api/auth';
import { withIdempotency } from '@/lib/idempotency/server';

const mockRequireUser = vi.mocked(requireUser);
const mockWithIdempotency = vi.mocked(withIdempotency);

const VALID_UUID  = '550e8400-e29b-41d4-a716-446655440000';
const WORKOUT_ID  = '660e8400-e29b-41d4-a716-446655440000';
const DRAFT_ID    = '770e8400-e29b-41d4-a716-446655440000';
const USER_ID     = 'user-aaa0-0000-0000-000000000000';

/** Supabase mock whose maybySingle returns different rows per call count. */
function makeRestoreSupabase(opts: {
  targetWorkout: Record<string, unknown> | null;
  activeDraft?: Record<string, unknown> | null;
}) {
  let callCount = 0;
  return {
    from: vi.fn().mockImplementation(() => {
      callCount++;
      const data = callCount === 1 ? opts.targetWorkout : (opts.activeDraft ?? null);
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data, error: null }),
            }),
          }),
        }),
      };
    }),
  };
}

function makeRequest(workoutId = WORKOUT_ID): [Request, { params: Promise<{ id: string }> }] {
  return [
    new Request(`http://localhost/api/workouts/${workoutId}/restore`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientMutationId: VALID_UUID }),
    }),
    { params: Promise.resolve({ id: workoutId }) },
  ];
}

describe('POST /api/workouts/[id]/restore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when requireUser throws ApiAuthError', async () => {
    const { ApiAuthError } = await import('@/lib/api/auth');
    mockRequireUser.mockRejectedValueOnce(new ApiAuthError());

    const [req, ctx] = makeRequest();
    const res = await POST(req, ctx);

    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 400 when body fails schema validation', async () => {
    mockRequireUser.mockResolvedValueOnce({
      supabase: makeRestoreSupabase({ targetWorkout: null }) as any,
      user: { id: USER_ID } as any,
    });

    const [, ctx] = makeRequest();
    const res = await POST(
      new Request(`http://localhost/api/workouts/${WORKOUT_ID}/restore`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientMutationId: 'not-a-uuid' }),
      }),
      ctx,
    );

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 422 ACTIVE_DRAFT_EXISTS when user already has an in_progress workout', async () => {
    const expiredWorkout = {
      id: WORKOUT_ID,
      name: null,
      status: 'expired',
      started_at: '2026-01-01T00:00:00.000Z',
      last_activity_at: '2026-01-01T00:00:00.000Z',
      plan_workout_id: null,
    };
    const activeDraft = {
      id: DRAFT_ID,
      name: 'Active Workout',
      started_at: '2026-04-01T00:00:00.000Z',
      last_activity_at: '2026-04-01T00:00:00.000Z',
      plan_workout_id: null,
    };

    mockRequireUser.mockResolvedValueOnce({
      supabase: makeRestoreSupabase({ targetWorkout: expiredWorkout, activeDraft }) as any,
      user: { id: USER_ID } as any,
    });

    // Call through so the inner handler logic runs and throws RouteError.
    mockWithIdempotency.mockImplementation(async (opts: any) => opts.handler());

    const [req, ctx] = makeRequest();
    const res = await POST(req, ctx);

    expect(res.status).toBe(422);
    const json = await res.json();
    expect(json.error.code).toBe('ACTIVE_DRAFT_EXISTS');
    expect(json.error.details.activeDraft.id).toBe(DRAFT_ID);
  });
});
```

- [ ] **Step 2: Run tests**

```bash
npx vitest run "app/api/workouts/\[id\]/restore/route.test.ts" --reporter=verbose
```

Expected: 3 PASS

- [ ] **Step 3: Commit**

```bash
git add "app/api/workouts/[id]/restore/route.test.ts"
git commit -m "test(routes/restore): 401, 400, and 422 ACTIVE_DRAFT_EXISTS cases"
```

---

## Task 7: `app/api/workout-exercises/route.test.ts`

**Files:**
- Create: `app/api/workout-exercises/route.test.ts`

- [ ] **Step 1: Write the test file**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/api/auth', () => ({
  requireUser: vi.fn(),
  ApiAuthError: class ApiAuthError extends Error {
    constructor(message = 'Unauthorized') {
      super(message);
      this.name = 'ApiAuthError';
    }
  },
}));

vi.mock('@/lib/idempotency/server', () => ({
  withIdempotency: vi.fn(),
  IdempotencyValidationError: class IdempotencyValidationError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'IdempotencyValidationError';
    }
  },
}));

import { POST } from './route';
import { requireUser } from '@/lib/api/auth';
import { withIdempotency } from '@/lib/idempotency/server';

const mockRequireUser = vi.mocked(requireUser);
const mockWithIdempotency = vi.mocked(withIdempotency);

const CLIENT_MUTATION_ID = '550e8400-e29b-41d4-a716-446655440000';
const WORKOUT_ID         = '660e8400-e29b-41d4-a716-446655440000';
const EXERCISE_ID        = '770e8400-e29b-41d4-a716-446655440000';
const RESOURCE_ID        = '880e8400-e29b-41d4-a716-446655440000';
const USER_ID            = 'user-aaa0-0000-0000-000000000000';

function makeRequest(): Request {
  return new Request('http://localhost/api/workout-exercises', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      clientMutationId: CLIENT_MUTATION_ID,
      localId: '990e8400-e29b-41d4-a716-446655440000',
      workoutId: WORKOUT_ID,
      exerciseId: EXERCISE_ID,
      position: 0,
    }),
  });
}

function makeSupabase(): any {
  return {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      }),
    }),
  };
}

describe('POST /api/workout-exercises', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when requireUser throws ApiAuthError', async () => {
    const { ApiAuthError } = await import('@/lib/api/auth');
    mockRequireUser.mockRejectedValueOnce(new ApiAuthError());

    const res = await POST(makeRequest());

    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 400 VALIDATION_ERROR when body fails schema validation', async () => {
    mockRequireUser.mockResolvedValueOnce({
      supabase: makeSupabase(),
      user: { id: USER_ID } as any,
    });

    const req = new Request('http://localhost/api/workout-exercises', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientMutationId: 'not-a-uuid' }),
    });

    const res = await POST(req);

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error.code).toBe('VALIDATION_ERROR');
    expect(mockWithIdempotency).not.toHaveBeenCalled();
  });

  it('returns 200 with id + clientMutationId on replay', async () => {
    mockRequireUser.mockResolvedValueOnce({
      supabase: makeSupabase(),
      user: { id: USER_ID } as any,
    });
    mockWithIdempotency.mockResolvedValueOnce({
      replayed: true,
      resourceId: RESOURCE_ID,
      response: null,
    });

    const res = await POST(makeRequest());

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.id).toBe(RESOURCE_ID);
    expect(json.clientMutationId).toBe(CLIENT_MUTATION_ID);
  });

  it('returns 201 with id + clientMutationId on first create', async () => {
    mockRequireUser.mockResolvedValueOnce({
      supabase: makeSupabase(),
      user: { id: USER_ID } as any,
    });
    mockWithIdempotency.mockResolvedValueOnce({
      replayed: false,
      resourceId: RESOURCE_ID,
      response: { id: RESOURCE_ID, clientMutationId: CLIENT_MUTATION_ID },
    });

    const res = await POST(makeRequest());

    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.id).toBe(RESOURCE_ID);
    expect(json.clientMutationId).toBe(CLIENT_MUTATION_ID);
  });
});
```

- [ ] **Step 2: Run tests**

```bash
npx vitest run app/api/workout-exercises/route.test.ts --reporter=verbose
```

Expected: 4 PASS

- [ ] **Step 3: Commit**

```bash
git add app/api/workout-exercises/route.test.ts
git commit -m "test(routes/workout-exercises): 401, 400, replay, and 201 create cases"
```

---

## Task 8: `app/api/sets/route.test.ts`

**Files:**
- Create: `app/api/sets/route.test.ts`

- [ ] **Step 1: Write the test file**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/api/auth', () => ({
  requireUser: vi.fn(),
  ApiAuthError: class ApiAuthError extends Error {
    constructor(message = 'Unauthorized') {
      super(message);
      this.name = 'ApiAuthError';
    }
  },
}));

vi.mock('@/lib/idempotency/server', () => ({
  withIdempotency: vi.fn(),
  IdempotencyValidationError: class IdempotencyValidationError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'IdempotencyValidationError';
    }
  },
}));

import { POST } from './route';
import { requireUser } from '@/lib/api/auth';
import { withIdempotency } from '@/lib/idempotency/server';

const mockRequireUser = vi.mocked(requireUser);
const mockWithIdempotency = vi.mocked(withIdempotency);

const CLIENT_MUTATION_ID    = '550e8400-e29b-41d4-a716-446655440000';
const WORKOUT_EXERCISE_ID   = '660e8400-e29b-41d4-a716-446655440000';
const RESOURCE_ID           = '880e8400-e29b-41d4-a716-446655440000';
const USER_ID               = 'user-aaa0-0000-0000-000000000000';

function makeRequest(): Request {
  return new Request('http://localhost/api/sets', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      clientMutationId: CLIENT_MUTATION_ID,
      localId: '990e8400-e29b-41d4-a716-446655440000',
      workoutExerciseId: WORKOUT_EXERCISE_ID,
      setNumber: 1,
      reps: 10,
      weightValue: 60,
      weightUnit: 'kg',
      loggedAt: '2026-05-01T10:00:00.000Z',
    }),
  });
}

function makeSupabase(): any {
  return {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      }),
    }),
  };
}

describe('POST /api/sets', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when requireUser throws ApiAuthError', async () => {
    const { ApiAuthError } = await import('@/lib/api/auth');
    mockRequireUser.mockRejectedValueOnce(new ApiAuthError());

    const res = await POST(makeRequest());

    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 400 VALIDATION_ERROR when body fails schema validation', async () => {
    mockRequireUser.mockResolvedValueOnce({
      supabase: makeSupabase(),
      user: { id: USER_ID } as any,
    });

    const req = new Request('http://localhost/api/sets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientMutationId: 'not-a-uuid' }),
    });

    const res = await POST(req);

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error.code).toBe('VALIDATION_ERROR');
    expect(mockWithIdempotency).not.toHaveBeenCalled();
  });

  it('returns 200 with id + clientMutationId on replay', async () => {
    mockRequireUser.mockResolvedValueOnce({
      supabase: makeSupabase(),
      user: { id: USER_ID } as any,
    });
    mockWithIdempotency.mockResolvedValueOnce({
      replayed: true,
      resourceId: RESOURCE_ID,
      response: null,
    });

    const res = await POST(makeRequest());

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.id).toBe(RESOURCE_ID);
    expect(json.clientMutationId).toBe(CLIENT_MUTATION_ID);
  });

  it('returns 201 with id + clientMutationId on first log', async () => {
    mockRequireUser.mockResolvedValueOnce({
      supabase: makeSupabase(),
      user: { id: USER_ID } as any,
    });
    mockWithIdempotency.mockResolvedValueOnce({
      replayed: false,
      resourceId: RESOURCE_ID,
      response: { id: RESOURCE_ID, clientMutationId: CLIENT_MUTATION_ID },
    });

    const res = await POST(makeRequest());

    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.id).toBe(RESOURCE_ID);
    expect(json.clientMutationId).toBe(CLIENT_MUTATION_ID);
  });
});
```

- [ ] **Step 2: Run all tests to confirm the full suite passes**

```bash
npx vitest run --reporter=verbose
```

Expected: all tests green (existing suite plus new files)

- [ ] **Step 3: Commit**

```bash
git add app/api/sets/route.test.ts
git commit -m "test(routes/sets): 401, 400, replay, and 201 create cases"
```

---

## Task 9: Update `app/api/sets/README.md`

Add full request-body schemas and exact response shapes per endpoint. The existing content covers ownership, status gating, and weight_unit — preserve and extend it.

**Files:**
- Modify: `app/api/sets/README.md`

- [ ] **Step 1: Replace the file with the full content**

Replace the entire content of `app/api/sets/README.md` with:

```markdown
# app/api/sets

Mutation surface for logged sets — the highest-frequency API calls in the app (one per set logged).

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/sets` | Log a set (create) |
| `PATCH` | `/api/sets/[id]` | Edit a logged set (inline editing) |
| `DELETE` | `/api/sets/[id]` | Remove a logged set |

All handlers:
- Authenticate via `requireUser()`.
- Wrap mutations in `withIdempotency` — safe to retry from the offline queue.
- Call `touchWorkoutLastActivity()` on the grandparent workout after each successful mutation.

---

## `POST /api/sets` — log a set

**File:** `route.ts`

**Schema:** `setLogBodySchema`

```json
{
  "clientMutationId": "<v4 UUID>",
  "localId":          "<v4 UUID>",
  "workoutExerciseId":"<v4 UUID>",
  "setNumber":        1,
  "reps":             10,
  "weightValue":      60.5,
  "weightUnit":       "kg",
  "loggedAt":         "2026-05-01T10:00:00.000Z"
}
```

### Responses

| Condition | Status | Body |
|-----------|--------|------|
| Created | `201` | `{ id, clientMutationId }` |
| Replay | `200` | `{ id, clientMutationId }` |
| Workout exercise not found | `404` | `NOT_FOUND` |
| Parent workout not `in_progress` | `422` | `WORKOUT_NOT_IN_PROGRESS` |
| Invalid body | `400` | `VALIDATION_ERROR` |
| Unauthenticated | `401` | `UNAUTHORIZED` |

### Idempotency key

`set.log` — stored in `mutation_receipts.mutation_type`. Replays return `200` with the original `id`.

---

## `PATCH /api/sets/[id]` — edit a logged set

**File:** `[id]/route.ts`

**Schema:** `setEditBodySchema` — requires at least one of `reps`, `weightValue`, or `weightUnit`.

```json
{
  "clientMutationId": "<v4 UUID>",
  "reps":             12,
  "weightValue":      70,
  "weightUnit":       "lbs"
}
```

> A body with only `clientMutationId` and no edit fields is rejected with `400 VALIDATION_ERROR`.

### Responses

| Condition | Status | Body |
|-----------|--------|------|
| Success | `200` | `{ id, clientMutationId }` |
| Replay | `200` | `{ id, clientMutationId }` |
| Set not found | `404` | `NOT_FOUND` |
| Invalid UUID in path | `400` | `INVALID_ID` |
| Invalid body | `400` | `VALIDATION_ERROR` |
| Unauthenticated | `401` | `UNAUTHORIZED` |

### Idempotency key

`set.edit`

---

## `DELETE /api/sets/[id]` — remove a logged set

**File:** `[id]/route.ts`

**Schema:** `setDeleteBodySchema`

```json
{
  "clientMutationId": "<v4 UUID>"
}
```

### Responses

| Condition | Status | Body |
|-----------|--------|------|
| Deleted (or already gone) | `200` | `{ id, clientMutationId }` |
| Replay | `200` | `{ id, clientMutationId }` |
| Invalid UUID in path | `400` | `INVALID_ID` |
| Invalid body | `400` | `VALIDATION_ERROR` |
| Unauthenticated | `401` | `UNAUTHORIZED` |

### Idempotency key

`set.delete` — missing rows are treated as already deleted (idempotent `200`).

---

## Ownership check

Each handler resolves the grandparent workout via a join (`workout_exercises!inner → workouts!inner`) in a single round trip. RLS on `workouts` (`user_id = auth.uid()`) enforces ownership; the `!inner` modifier propagates the filter so a missing or foreign-user workout causes the lookup row to be absent (→ 404 on PATCH, idempotent 200 on DELETE).

## Status gating

- **POST** requires the parent workout to be `in_progress`. Logging to a completed/expired workout → 422.
- **PATCH / DELETE** have **no** status gate — Flow 6 (inline editing) allows modifying or removing sets in completed workouts without re-opening them.

## `weight_unit` is per-set

`weight_unit` is stored on each `sets` row, **not** on the workout or the user profile. A future per-set unit-toggle UI (e.g. mixing lbs and kg in a single session) works without any server-side changes — the client simply passes the desired `weightUnit` on each `POST` or `PATCH`.

## Shared error body shape

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable description"
  }
}
```

`details` is included when there is extra context (e.g. Zod validation issues).
```

- [ ] **Step 2: Verify no placeholder text remains**

```bash
grep -n "TODO\|TBD\|placeholder\|fill" app/api/sets/README.md || echo "clean"
```

Expected: `clean`

- [ ] **Step 3: Commit**

```bash
git add app/api/sets/README.md
git commit -m "docs(sets): full request bodies, response tables, and error shapes"
```

---

## Task 10: Update `app/api/workout-exercises/README.md`

Add request-body schemas and exact response tables for each endpoint.

**Files:**
- Modify: `app/api/workout-exercises/README.md`

- [ ] **Step 1: Replace the file with the full content**

Replace the entire content of `app/api/workout-exercises/README.md` with:

```markdown
# app/api/workout-exercises

Mutation surface for adding, reordering, and removing exercises from an active workout draft.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/workout-exercises` | Add an exercise to an in_progress workout |
| `PATCH` | `/api/workout-exercises/[id]` | Reorder a single exercise by position |
| `DELETE` | `/api/workout-exercises/[id]` | Remove an exercise (cascades child sets) |

All handlers:
- Authenticate via `requireUser()`.
- Wrap mutations in `withIdempotency` — safe to retry from the offline queue.
- Call `touchWorkoutLastActivity()` on the parent workout after each successful mutation.

---

## `POST /api/workout-exercises` — add exercise

**File:** `route.ts`

**Schema:** `workoutExerciseAddBodySchema`

```json
{
  "clientMutationId": "<v4 UUID>",
  "localId":          "<v4 UUID>",
  "workoutId":        "<v4 UUID>",
  "exerciseId":       "<v4 UUID>",
  "position":         0
}
```

### Responses

| Condition | Status | Body |
|-----------|--------|------|
| Created | `201` | `{ id, clientMutationId }` |
| Replay | `200` | `{ id, clientMutationId }` |
| Workout not found | `404` | `NOT_FOUND` |
| Workout not `in_progress` | `422` | `WORKOUT_NOT_IN_PROGRESS` |
| Exercise not found/accessible | `422` | `INVALID_EXERCISE` |
| Invalid body | `400` | `VALIDATION_ERROR` |
| Unauthenticated | `401` | `UNAUTHORIZED` |

### Idempotency key

`workoutExercise.add` — stored in `mutation_receipts.mutation_type`. Replays return `200` with the original `id`.

---

## `PATCH /api/workout-exercises/[id]` — reorder

**File:** `[id]/route.ts`

**Schema:** `workoutExerciseReorderBodySchema`

```json
{
  "clientMutationId": "<v4 UUID>",
  "position":         3
}
```

### Responses

| Condition | Status | Body |
|-----------|--------|------|
| Success | `200` | `{ id, clientMutationId }` |
| Replay | `200` | `{ id, clientMutationId }` |
| Exercise not found or parent not `in_progress` | `404` | `NOT_FOUND` |
| Invalid UUID in path | `400` | `INVALID_ID` |
| Invalid body | `400` | `VALIDATION_ERROR` |
| Unauthenticated | `401` | `UNAUTHORIZED` |

### Idempotency key

`workoutExercise.reorder`

**Non-atomic reorder:** The client sends one `PATCH` per moved exercise (see `useActiveWorkoutStore.reorderExercises`). There is no unique constraint on `(workout_id, position)`, so concurrent patches from multiple tabs are safe — last write wins per exercise row. Callers must not assume positions are globally consistent until all patches in a reorder sequence have settled.

---

## `DELETE /api/workout-exercises/[id]` — remove

**File:** `[id]/route.ts`

**Schema:** `workoutExerciseDeleteBodySchema`

```json
{
  "clientMutationId": "<v4 UUID>"
}
```

### Responses

| Condition | Status | Body |
|-----------|--------|------|
| Deleted (or already gone) | `200` | `{ id, clientMutationId }` |
| Replay | `200` | `{ id, clientMutationId }` |
| Parent workout not `in_progress` | `422` | `WORKOUT_NOT_IN_PROGRESS` |
| Invalid UUID in path | `400` | `INVALID_ID` |
| Invalid body | `400` | `VALIDATION_ERROR` |
| Unauthenticated | `401` | `UNAUTHORIZED` |

Child `sets` rows are removed via `ON DELETE CASCADE`. Already-deleted rows return `200` (idempotent).

### Idempotency key

`workoutExercise.remove`

---

## Cross-cutting

All three handlers share:

- **Parent-ownership check** — verifies the parent workout belongs to the calling user.
- **`last_activity_at` touch** — bumps the parent workout's `last_activity_at` timestamp after every successful mutation so the active-draft list stays sorted by recency.
- **Idempotency** via `withIdempotency` (see [`lib/idempotency/`](../../../lib/idempotency/README.md)).

`POST /api/exercises` (creating new exercise definitions) is out of scope — handled by T8.

## Shared error body shape

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable description"
  }
}
```
```

- [ ] **Step 2: Verify no placeholder text remains**

```bash
grep -n "TODO\|TBD\|placeholder\|fill" app/api/workout-exercises/README.md || echo "clean"
```

Expected: `clean`

- [ ] **Step 3: Commit**

```bash
git add app/api/workout-exercises/README.md
git commit -m "docs(workout-exercises): full request bodies, response tables, and error shapes"
```

---

## Task 11: Update `lib/idempotency/README.md` with cross-links

Add a "Routes that consume this module" section near the end of the file so readers can navigate from the idempotency docs to each consuming route.

**Files:**
- Modify: `lib/idempotency/README.md`

- [ ] **Step 1: Append the cross-links section**

The current `lib/idempotency/README.md` ends after the Hydration note section (line 110). Append the following:

```markdown

## Routes that consume this module

| Route file | `mutationType` values stored |
|------------|------------------------------|
| [`app/api/workouts/route.ts`](../../app/api/workouts/route.ts) | `workout.create` |
| [`app/api/workouts/[id]/route.ts`](../../app/api/workouts/[id]/route.ts) | `workout.patch`, `workout.discard` |
| [`app/api/workouts/[id]/restore/route.ts`](../../app/api/workouts/[id]/restore/route.ts) | `workout.restore` |
| [`app/api/workout-exercises/route.ts`](../../app/api/workout-exercises/route.ts) | `workoutExercise.add` |
| [`app/api/workout-exercises/[id]/route.ts`](../../app/api/workout-exercises/[id]/route.ts) | `workoutExercise.reorder`, `workoutExercise.remove` |
| [`app/api/sets/route.ts`](../../app/api/sets/route.ts) | `set.log` |
| [`app/api/sets/[id]/route.ts`](../../app/api/sets/[id]/route.ts) | `set.edit`, `set.delete` |

Each route handler creates a `createSupabaseServerClient()` session-scoped client and passes it to `withIdempotency`. The idempotency layer uses the same client for all `mutation_receipts` reads and writes, so a single session token covers both the route-specific DB work and the receipt management.
```

- [ ] **Step 2: Verify cross-links**

```bash
grep -n "app/api" lib/idempotency/README.md
```

Expected: 7 route lines printed

- [ ] **Step 3: Commit**

```bash
git add lib/idempotency/README.md
git commit -m "docs(idempotency): add cross-links to all consuming routes"
```

---

## Final Verification

- [ ] **Run the full test suite**

```bash
npx vitest run --reporter=verbose
```

Expected: all tests pass (no failures, no skipped)

- [ ] **Confirm test file inventory**

```bash
find . -name "*.test.ts" -not -path "*/node_modules/*" | sort
```

Expected output includes:
```
./app/api/sets/route.test.ts
./app/api/workout-exercises/route.test.ts
./app/api/workouts/[id]/restore/route.test.ts
./app/api/workouts/route.test.ts
./features/workout/store/__tests__/queue.test.ts
./lib/idempotency/__tests__/server.test.ts
./lib/idempotency/server.test.ts
./lib/schemas/__tests__/set.test.ts
./lib/schemas/__tests__/workout-exercise.test.ts
./lib/schemas/__tests__/workout.test.ts
```

---

## Client Contract Checklist (PR description)

Include the following checklist in the PR description to capture the manual cross-check:

```
## Client contract verification

- [x] Every CREATE response body has `string id` + exact-echo `clientMutationId`
      - POST /api/workouts → `{ id, clientMutationId, alreadyExisted, ... }`
      - POST /api/workout-exercises → `{ id, clientMutationId }`
      - POST /api/sets → `{ id, clientMutationId }`
      Verified against `dispatchMutation()` validator in `features/workout/store/queue.ts:391–415`

- [x] Every non-create response body has `clientMutationId` (debug breadcrumb)
      - PATCH /api/workouts/[id] → `{ id, clientMutationId }`
      - DELETE /api/workouts/[id] → `{ id, clientMutationId }`
      - POST /api/workouts/[id]/restore → `{ id, clientMutationId, workout: {...} }`
      - PATCH /api/workout-exercises/[id] → `{ id, clientMutationId }`
      - DELETE /api/workout-exercises/[id] → `{ id, clientMutationId }`
      - PATCH /api/sets/[id] → `{ id, clientMutationId }`
      - DELETE /api/sets/[id] → `{ id, clientMutationId }`

- [x] Request body field name is `clientMutationId` (camelCase) — matches
      `buildRequest()` in `features/workout/store/queue.ts` and all Zod schemas

- [x] 422 responses on permanent conflicts are intentional — queue quarantines them
      - `ACTIVE_DRAFT_EXISTS` on restore: user must finish/discard their draft first
      - `CANNOT_DISCARD_COMPLETED`: completed workouts are managed via history delete (T10)
      - `WORKOUT_NOT_IN_PROGRESS` on set.log: logging to closed workouts is a permanent conflict
```
