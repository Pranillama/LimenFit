# Body Metrics Implementation Plan

> **Status: Shipped ✓** — merged to `main` (PR #2). Historical record; not maintained.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the `/profile/body-metrics` section — a BMI card, a bodyweight log with chart, and a body-measurements form — backed by two new per-day time-series tables.

**Architecture:** Two new tables (`bodyweight_entries`, `body_measurements`), each keyed `UNIQUE(user_id, recorded_on)` so the API upserts one row per user per day. Pages read via server helpers (like `getOrCreateProfile`); mutations go through two thin routes (`POST /api/bodyweight`, `PATCH /api/measurements`) that return their DTO, after which the client calls `router.refresh()` to re-read server data. All weights stored in kg, lengths in cm; UI converts at render using the user's unit prefs. BMI and weight-delta are pure functions in a unit-tested `derive` module.

**Tech Stack:** Next.js 15 (App Router, RSC), TypeScript, Supabase (Postgres + RLS), Zod, TanStack Query, recharts (already installed), Vitest, Tailwind + shadcn/ui.

**Conventions to follow (verified against the codebase):**

- Migration mirrors `supabase/migrations/20260603000001_profiles.sql`: `set_updated_at` trigger + 4 RLS policies per table.
- Server helpers mirror `lib/profile/server.ts` (`assertServerOnly()`, `rowToDTO`, `Number(...)` numeric coercion).
- Routes mirror `app/api/profile/route.ts` / `app/api/settings/route.ts` (`requireUser`, `handleApiError`, `jsonOk`/`jsonCreated`, camel→snake map).
- Route tests mirror `app/api/settings/route.test.ts` (mock `@/lib/api/auth`, fake supabase with `upsert→select→single`).
- Mutation hooks mirror `features/profile/hooks/useUpdateProfileMutation.ts`.
- Unit conversions live in `features/profile/lib/unitConversions.ts`.

---

## File Structure

**Create:**

- `supabase/migrations/20260607000001_body_metrics.sql` — two tables + triggers + RLS
- `lib/body-metrics/derive.ts` — pure `computeBmi`, `bmiCategory`, `weightDelta`
- `lib/body-metrics/__tests__/derive.test.ts`
- `lib/schemas/body-metrics.ts` — Zod schemas + DTOs
- `lib/schemas/__tests__/body-metrics.test.ts`
- `lib/body-metrics/server.ts` — get/upsert helpers + `todayUtc`
- `lib/body-metrics/index.ts` — barrel
- `app/api/bodyweight/route.ts` + `app/api/bodyweight/route.test.ts`
- `app/api/measurements/route.ts` + `app/api/measurements/route.test.ts`
- `features/profile/hooks/useLogBodyweightMutation.ts`
- `features/profile/hooks/useUpdateMeasurementsMutation.ts`
- `features/profile/components/BmiCard.tsx`
- `features/profile/components/WeightChart.tsx`
- `features/profile/components/BodyweightSection.tsx`
- `features/profile/components/MeasurementsForm.tsx`
- `features/profile/components/ProgressPhotosPlaceholder.tsx`

**Modify:**

- `features/profile/lib/unitConversions.ts` — add `inToCm`, `cmToIn`
- `features/profile/index.ts` — export the four new section components
- `app/(app)/profile/body-metrics/page.tsx` — replace stub with real page
- `lib/supabase/types.ts` — regenerated after migration

---

## Task 1: Migration + regenerated types

**Files:**

- Create: `supabase/migrations/20260607000001_body_metrics.sql`
- Modify (generated): `lib/supabase/types.ts`

- [ ] **Step 1: Write the migration**

```sql
-- Body metrics: per-user, per-day time-series for bodyweight and measurements.
-- All weights stored in kg, all lengths in cm. Display conversion is client-side.
-- One row per (user, day); the API upserts on (user_id, recorded_on) so logging
-- twice in a day updates that day's row rather than creating duplicates.

CREATE TABLE public.bodyweight_entries (
  id           uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid          NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  weight_kg    numeric(6,2)  NOT NULL CHECK (weight_kg > 0 AND weight_kg <= 500),
  recorded_on  date          NOT NULL DEFAULT (now() AT TIME ZONE 'utc')::date,
  created_at   timestamptz   NOT NULL DEFAULT now(),
  updated_at   timestamptz   NOT NULL DEFAULT now(),
  UNIQUE (user_id, recorded_on)
);

CREATE INDEX bodyweight_entries_user_date_idx
  ON public.bodyweight_entries (user_id, recorded_on);

CREATE TABLE public.body_measurements (
  id            uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid          NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recorded_on   date          NOT NULL DEFAULT (now() AT TIME ZONE 'utc')::date,
  body_fat_pct  numeric(4,1)  CHECK (body_fat_pct >= 0 AND body_fat_pct <= 100),
  waist_cm      numeric(5,1)  CHECK (waist_cm > 0 AND waist_cm <= 500),
  chest_cm      numeric(5,1)  CHECK (chest_cm > 0 AND chest_cm <= 500),
  arms_cm       numeric(5,1)  CHECK (arms_cm > 0 AND arms_cm <= 500),
  legs_cm       numeric(5,1)  CHECK (legs_cm > 0 AND legs_cm <= 500),
  created_at    timestamptz   NOT NULL DEFAULT now(),
  updated_at    timestamptz   NOT NULL DEFAULT now(),
  UNIQUE (user_id, recorded_on)
);

CREATE INDEX body_measurements_user_date_idx
  ON public.body_measurements (user_id, recorded_on);

CREATE TRIGGER set_updated_at_bodyweight_entries
  BEFORE UPDATE ON public.bodyweight_entries
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_updated_at_body_measurements
  BEFORE UPDATE ON public.body_measurements
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS: owner-only access on both tables.
ALTER TABLE public.bodyweight_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.body_measurements ENABLE ROW LEVEL SECURITY;

CREATE POLICY bodyweight_entries_select ON public.bodyweight_entries
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY bodyweight_entries_insert ON public.bodyweight_entries
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY bodyweight_entries_update ON public.bodyweight_entries
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY bodyweight_entries_delete ON public.bodyweight_entries
  FOR DELETE USING (user_id = auth.uid());

CREATE POLICY body_measurements_select ON public.body_measurements
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY body_measurements_insert ON public.body_measurements
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY body_measurements_update ON public.body_measurements
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY body_measurements_delete ON public.body_measurements
  FOR DELETE USING (user_id = auth.uid());
```

- [ ] **Step 2: Apply the migration locally**

Requires local Supabase running (Docker file-sharing must include `/Users/<you>`).

Run: `pnpm db:reset`
Expected: reset completes with no SQL errors; both `CREATE TABLE` statements apply.

- [ ] **Step 3: Regenerate Supabase types**

Run: `pnpm dlx supabase gen types typescript --local > lib/supabase/types.ts`
Expected: `lib/supabase/types.ts` now contains `bodyweight_entries` and `body_measurements` table definitions.

- [ ] **Step 4: Type-check**

Run: `pnpm type-check`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260607000001_body_metrics.sql lib/supabase/types.ts
git commit -m "feat(body-metrics): add bodyweight_entries and body_measurements tables"
```

---

## Task 2: Derive module (BMI + weight delta) — TDD

**Files:**

- Test: `lib/body-metrics/__tests__/derive.test.ts`
- Create: `lib/body-metrics/derive.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, it, expect } from 'vitest';

import { computeBmi, bmiCategory, weightDelta } from '../derive';

describe('computeBmi', () => {
  it('computes BMI rounded to one decimal (5\'10", 186.4 lb ≈ 84.55 kg)', () => {
    expect(computeBmi(177.8, 84.55)).toBe(26.7);
  });

  it('returns null when height is missing', () => {
    expect(computeBmi(null, 80)).toBeNull();
  });

  it('returns null when weight is missing', () => {
    expect(computeBmi(180, null)).toBeNull();
  });

  it('returns null for non-positive inputs', () => {
    expect(computeBmi(0, 80)).toBeNull();
    expect(computeBmi(180, 0)).toBeNull();
  });
});

describe('bmiCategory', () => {
  it('classifies the four bands at their boundaries', () => {
    expect(bmiCategory(18.4).key).toBe('underweight');
    expect(bmiCategory(18.5).key).toBe('normal');
    expect(bmiCategory(24.9).key).toBe('normal');
    expect(bmiCategory(25).key).toBe('overweight');
    expect(bmiCategory(29.9).key).toBe('overweight');
    expect(bmiCategory(30).key).toBe('obese');
  });

  it('exposes a human label', () => {
    expect(bmiCategory(26.7).label).toBe('Overweight');
  });
});

describe('weightDelta', () => {
  it('returns null with fewer than two entries', () => {
    expect(weightDelta([])).toBeNull();
    expect(weightDelta([{ weightKg: 90, recordedOn: '2026-03-03' }])).toBeNull();
  });

  it('computes delta (latest minus earliest) and week span, regardless of input order', () => {
    const result = weightDelta([
      { weightKg: 84.5, recordedOn: '2026-06-02' },
      { weightKg: 90.0, recordedOn: '2026-03-03' },
    ]);
    expect(result).not.toBeNull();
    expect(result!.deltaKg).toBe(-5.5);
    expect(result!.weeks).toBe(13);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm test -- lib/body-metrics/__tests__/derive.test.ts`
Expected: FAIL — `Cannot find module '../derive'`.

- [ ] **Step 3: Implement `derive.ts`**

```ts
export type BmiCategoryKey = 'underweight' | 'normal' | 'overweight' | 'obese';

export type BmiCategory = {
  key: BmiCategoryKey;
  label: string;
};

/** BMI = kg / m^2, rounded to one decimal. Null when inputs are missing or non-positive. */
export function computeBmi(heightCm: number | null, weightKg: number | null): number | null {
  if (heightCm === null || weightKg === null) return null;
  if (heightCm <= 0 || weightKg <= 0) return null;
  const m = heightCm / 100;
  return Math.round((weightKg / (m * m)) * 10) / 10;
}

export function bmiCategory(bmi: number): BmiCategory {
  if (bmi < 18.5) return { key: 'underweight', label: 'Underweight' };
  if (bmi < 25) return { key: 'normal', label: 'Normal' };
  if (bmi < 30) return { key: 'overweight', label: 'Overweight' };
  return { key: 'obese', label: 'Obese' };
}

export type WeightDelta = { deltaKg: number; weeks: number };

/**
 * Delta from the earliest to the latest entry. Entries may be unsorted; we sort
 * by recordedOn ascending. Returns null with fewer than two entries.
 */
export function weightDelta(
  entries: Array<{ weightKg: number; recordedOn: string }>,
): WeightDelta | null {
  if (entries.length < 2) return null;
  const sorted = [...entries].sort((a, b) => a.recordedOn.localeCompare(b.recordedOn));
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const deltaKg = Math.round((last.weightKg - first.weightKg) * 10) / 10;
  const ms = new Date(last.recordedOn).getTime() - new Date(first.recordedOn).getTime();
  const weeks = Math.max(1, Math.round(ms / (7 * 24 * 60 * 60 * 1000)));
  return { deltaKg, weeks };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm test -- lib/body-metrics/__tests__/derive.test.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
git add lib/body-metrics/derive.ts lib/body-metrics/__tests__/derive.test.ts
git commit -m "feat(body-metrics): add BMI and weight-delta derive functions"
```

---

## Task 3: Inch/cm conversions — TDD

**Files:**

- Modify: `features/profile/lib/unitConversions.ts`
- Test: `features/profile/lib/__tests__/unitConversions.test.ts` (create if absent)

- [ ] **Step 1: Write the failing tests**

Append (or create the file with) these cases:

```ts
import { describe, it, expect } from 'vitest';

import { inToCm, cmToIn } from '../unitConversions';

describe('inToCm', () => {
  it('converts inches to centimetres, one decimal', () => {
    expect(inToCm(33)).toBe(83.8);
  });
});

describe('cmToIn', () => {
  it('converts centimetres to inches, one decimal', () => {
    expect(cmToIn(83.8)).toBe(33);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm test -- features/profile/lib/__tests__/unitConversions.test.ts`
Expected: FAIL — `inToCm`/`cmToIn` not exported.

- [ ] **Step 3: Add the functions to `unitConversions.ts`**

```ts
export function inToCm(inches: number): number {
  return Math.round(inches * 2.54 * 10) / 10;
}

export function cmToIn(cm: number): number {
  return Math.round((cm / 2.54) * 10) / 10;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm test -- features/profile/lib/__tests__/unitConversions.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add features/profile/lib/unitConversions.ts features/profile/lib/__tests__/unitConversions.test.ts
git commit -m "feat(body-metrics): add inch/cm conversion helpers"
```

---

## Task 4: Zod schemas + DTOs — TDD

**Files:**

- Test: `lib/schemas/__tests__/body-metrics.test.ts`
- Create: `lib/schemas/body-metrics.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, it, expect } from 'vitest';

import { bodyweightLogBodySchema, measurementsPatchBodySchema } from '../body-metrics';

describe('bodyweightLogBodySchema', () => {
  it('accepts a positive weight', () => {
    expect(bodyweightLogBodySchema.parse({ weightKg: 84.5 })).toEqual({ weightKg: 84.5 });
  });

  it('rejects zero, negative, and over-max weights', () => {
    expect(bodyweightLogBodySchema.safeParse({ weightKg: 0 }).success).toBe(false);
    expect(bodyweightLogBodySchema.safeParse({ weightKg: -1 }).success).toBe(false);
    expect(bodyweightLogBodySchema.safeParse({ weightKg: 501 }).success).toBe(false);
  });
});

describe('measurementsPatchBodySchema', () => {
  it('accepts a partial update', () => {
    expect(measurementsPatchBodySchema.parse({ waistCm: 83.8 })).toEqual({ waistCm: 83.8 });
  });

  it('accepts null to clear a field', () => {
    expect(measurementsPatchBodySchema.parse({ bodyFatPct: null })).toEqual({ bodyFatPct: null });
  });

  it('rejects an empty object', () => {
    expect(measurementsPatchBodySchema.safeParse({}).success).toBe(false);
  });

  it('rejects body fat over 100', () => {
    expect(measurementsPatchBodySchema.safeParse({ bodyFatPct: 101 }).success).toBe(false);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm test -- lib/schemas/__tests__/body-metrics.test.ts`
Expected: FAIL — `Cannot find module '../body-metrics'`.

- [ ] **Step 3: Implement `lib/schemas/body-metrics.ts`**

```ts
import { z } from 'zod';

export const bodyweightLogBodySchema = z.object({
  weightKg: z.number().positive().max(500),
});
export type BodyweightLogBody = z.infer<typeof bodyweightLogBodySchema>;

export type BodyweightEntryDTO = {
  id: string;
  weightKg: number;
  recordedOn: string; // YYYY-MM-DD
};

const lengthValue = z.number().positive().max(500).nullable();

export const measurementsPatchBodySchema = z
  .object({
    bodyFatPct: z.number().min(0).max(100).nullable().optional(),
    waistCm: lengthValue.optional(),
    chestCm: lengthValue.optional(),
    armsCm: lengthValue.optional(),
    legsCm: lengthValue.optional(),
  })
  .refine((d) => Object.keys(d).length > 0, {
    message: 'At least one measurement must be provided',
  });
export type MeasurementsPatchBody = z.infer<typeof measurementsPatchBodySchema>;

export type MeasurementsDTO = {
  bodyFatPct: number | null;
  waistCm: number | null;
  chestCm: number | null;
  armsCm: number | null;
  legsCm: number | null;
  recordedOn: string | null;
};
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm test -- lib/schemas/__tests__/body-metrics.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/schemas/body-metrics.ts lib/schemas/__tests__/body-metrics.test.ts
git commit -m "feat(body-metrics): add bodyweight + measurements schemas and DTOs"
```

---

## Task 5: Server helpers

**Files:**

- Create: `lib/body-metrics/server.ts`
- Create: `lib/body-metrics/index.ts`

(Server helpers are thin Supabase wrappers — build-verify by type-check, consistent with `lib/profile/server.ts` which has no unit test. The upsert mapping is exercised by the route tests in Tasks 6–7.)

- [ ] **Step 1: Implement `lib/body-metrics/server.ts`**

```ts
import type { SupabaseClient } from '@supabase/supabase-js';

import { assertServerOnly } from '@/lib/env';
import type { Database } from '@/lib/supabase/types';
import type { BodyweightEntryDTO, MeasurementsDTO } from '@/lib/schemas/body-metrics';

assertServerOnly();

type BodyweightRow = { id: string; weight_kg: number; recorded_on: string };

export function bodyweightRowToDTO(row: BodyweightRow): BodyweightEntryDTO {
  return { id: row.id, weightKg: Number(row.weight_kg), recordedOn: row.recorded_on };
}

export async function getBodyweightEntries(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<BodyweightEntryDTO[]> {
  const { data, error } = await supabase
    .from('bodyweight_entries')
    .select('id, weight_kg, recorded_on')
    .eq('user_id', userId)
    .order('recorded_on', { ascending: true });
  if (error) throw error;
  return (data ?? []).map((r) => bodyweightRowToDTO(r as unknown as BodyweightRow));
}

export async function upsertTodayBodyweight(
  supabase: SupabaseClient<Database>,
  userId: string,
  weightKg: number,
  today: string,
): Promise<BodyweightEntryDTO> {
  const { data, error } = await supabase
    .from('bodyweight_entries')
    .upsert(
      { user_id: userId, weight_kg: weightKg, recorded_on: today },
      { onConflict: 'user_id,recorded_on', ignoreDuplicates: false },
    )
    .select('id, weight_kg, recorded_on')
    .single();
  if (error) throw error;
  return bodyweightRowToDTO(data as unknown as BodyweightRow);
}

type MeasurementsRow = {
  body_fat_pct: number | null;
  waist_cm: number | null;
  chest_cm: number | null;
  arms_cm: number | null;
  legs_cm: number | null;
  recorded_on: string;
};

const MEASUREMENT_COLUMNS = 'body_fat_pct, waist_cm, chest_cm, arms_cm, legs_cm, recorded_on';

export function measurementsRowToDTO(row: MeasurementsRow): MeasurementsDTO {
  return {
    bodyFatPct: row.body_fat_pct === null ? null : Number(row.body_fat_pct),
    waistCm: row.waist_cm === null ? null : Number(row.waist_cm),
    chestCm: row.chest_cm === null ? null : Number(row.chest_cm),
    armsCm: row.arms_cm === null ? null : Number(row.arms_cm),
    legsCm: row.legs_cm === null ? null : Number(row.legs_cm),
    recordedOn: row.recorded_on,
  };
}

export async function getLatestMeasurements(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<MeasurementsDTO | null> {
  const { data, error } = await supabase
    .from('body_measurements')
    .select(MEASUREMENT_COLUMNS)
    .eq('user_id', userId)
    .order('recorded_on', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data ? measurementsRowToDTO(data as unknown as MeasurementsRow) : null;
}

export async function upsertTodayMeasurements(
  supabase: SupabaseClient<Database>,
  userId: string,
  fields: Record<string, number | null>,
  today: string,
): Promise<MeasurementsDTO> {
  const { data, error } = await supabase
    .from('body_measurements')
    .upsert(
      { user_id: userId, recorded_on: today, ...fields },
      { onConflict: 'user_id,recorded_on', ignoreDuplicates: false },
    )
    .select(MEASUREMENT_COLUMNS)
    .single();
  if (error) throw error;
  return measurementsRowToDTO(data as unknown as MeasurementsRow);
}

/** Today's date as YYYY-MM-DD (UTC). Passed explicitly to the upserts. */
export function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}
```

- [ ] **Step 2: Implement `lib/body-metrics/index.ts`**

```ts
export {
  getBodyweightEntries,
  upsertTodayBodyweight,
  getLatestMeasurements,
  upsertTodayMeasurements,
  todayUtc,
} from './server';
export { computeBmi, bmiCategory, weightDelta } from './derive';
export type { BmiCategory, BmiCategoryKey, WeightDelta } from './derive';
```

- [ ] **Step 3: Type-check**

Run: `pnpm type-check`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add lib/body-metrics/server.ts lib/body-metrics/index.ts
git commit -m "feat(body-metrics): add server read/upsert helpers"
```

---

## Task 6: `POST /api/bodyweight` route — TDD

**Files:**

- Test: `app/api/bodyweight/route.test.ts`
- Create: `app/api/bodyweight/route.ts`

- [ ] **Step 1: Write the failing tests**

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

import { POST } from './route';
import { requireUser } from '@/lib/api/auth';

const mockRequireUser = vi.mocked(requireUser);
const USER_ID = 'user-aaa0-0000-0000-000000000000';

function makeRequest(body: unknown): Request {
  return new Request('http://localhost/api/bodyweight', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function makeSupabase(returnData: unknown, returnError: unknown = null): any {
  return {
    from: vi.fn().mockReturnValue({
      upsert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: returnData, error: returnError }),
        }),
      }),
    }),
  };
}

describe('POST /api/bodyweight', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when requireUser throws ApiAuthError', async () => {
    const { ApiAuthError } = await import('@/lib/api/auth');
    mockRequireUser.mockRejectedValueOnce(new ApiAuthError());

    const res = await POST(makeRequest({ weightKg: 84.5 }));

    expect(res.status).toBe(401);
    expect((await res.json()).error.code).toBe('UNAUTHORIZED');
  });

  it('returns 400 VALIDATION_ERROR for a non-positive weight', async () => {
    mockRequireUser.mockResolvedValueOnce({
      supabase: makeSupabase(null),
      user: { id: USER_ID } as any,
    });

    const res = await POST(makeRequest({ weightKg: 0 }));

    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 201 with the upserted entry DTO', async () => {
    mockRequireUser.mockResolvedValueOnce({
      supabase: makeSupabase({
        id: 'entry-1',
        weight_kg: 84.5,
        recorded_on: '2026-06-07',
      }),
      user: { id: USER_ID } as any,
    });

    const res = await POST(makeRequest({ weightKg: 84.5 }));

    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json).toEqual({ id: 'entry-1', weightKg: 84.5, recordedOn: '2026-06-07' });
  });

  it('upserts with onConflict on user_id,recorded_on', async () => {
    const upsertSpy = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: { id: 'entry-1', weight_kg: 84.5, recorded_on: '2026-06-07' },
          error: null,
        }),
      }),
    });
    const supabase: any = { from: vi.fn().mockReturnValue({ upsert: upsertSpy }) };
    mockRequireUser.mockResolvedValueOnce({ supabase, user: { id: USER_ID } as any });

    await POST(makeRequest({ weightKg: 84.5 }));

    expect(upsertSpy).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: USER_ID, weight_kg: 84.5 }),
      { onConflict: 'user_id,recorded_on', ignoreDuplicates: false },
    );
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm test -- app/api/bodyweight/route.test.ts`
Expected: FAIL — `Cannot find module './route'`.

- [ ] **Step 3: Implement `app/api/bodyweight/route.ts`**

```ts
import { requireUser } from '@/lib/api/auth';
import { handleApiError, jsonCreated } from '@/lib/api/responses';
import { upsertTodayBodyweight, todayUtc } from '@/lib/body-metrics/server';
import { bodyweightLogBodySchema, type BodyweightEntryDTO } from '@/lib/schemas/body-metrics';

export const runtime = 'nodejs';

export async function POST(request: Request): Promise<Response> {
  try {
    const { supabase, user } = await requireUser();
    const body = bodyweightLogBodySchema.parse(await request.json());
    const entry = await upsertTodayBodyweight(supabase, user.id, body.weightKg, todayUtc());
    return jsonCreated<BodyweightEntryDTO>(entry);
  } catch (err) {
    return handleApiError(err);
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm test -- app/api/bodyweight/route.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/api/bodyweight/route.ts app/api/bodyweight/route.test.ts
git commit -m "feat(body-metrics): add POST /api/bodyweight upsert route"
```

---

## Task 7: `PATCH /api/measurements` route — TDD

**Files:**

- Test: `app/api/measurements/route.test.ts`
- Create: `app/api/measurements/route.ts`

- [ ] **Step 1: Write the failing tests**

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

import { PATCH } from './route';
import { requireUser } from '@/lib/api/auth';

const mockRequireUser = vi.mocked(requireUser);
const USER_ID = 'user-aaa0-0000-0000-000000000000';

function makeRequest(body: unknown): Request {
  return new Request('http://localhost/api/measurements', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const FULL_ROW = {
  body_fat_pct: 17.5,
  waist_cm: 83.8,
  chest_cm: 106.7,
  arms_cm: 39.4,
  legs_cm: 61,
  recorded_on: '2026-06-07',
};

function makeSupabase(returnData: unknown, returnError: unknown = null): any {
  return {
    from: vi.fn().mockReturnValue({
      upsert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: returnData, error: returnError }),
        }),
      }),
    }),
  };
}

describe('PATCH /api/measurements', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when requireUser throws ApiAuthError', async () => {
    const { ApiAuthError } = await import('@/lib/api/auth');
    mockRequireUser.mockRejectedValueOnce(new ApiAuthError());

    const res = await PATCH(makeRequest({ waistCm: 83.8 }));

    expect(res.status).toBe(401);
    expect((await res.json()).error.code).toBe('UNAUTHORIZED');
  });

  it('returns 400 VALIDATION_ERROR on empty body', async () => {
    mockRequireUser.mockResolvedValueOnce({
      supabase: makeSupabase(null),
      user: { id: USER_ID } as any,
    });

    const res = await PATCH(makeRequest({}));

    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 200 with the measurements DTO on partial update', async () => {
    mockRequireUser.mockResolvedValueOnce({
      supabase: makeSupabase(FULL_ROW),
      user: { id: USER_ID } as any,
    });

    const res = await PATCH(makeRequest({ waistCm: 83.8 }));

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.waistCm).toBe(83.8);
    expect(json.bodyFatPct).toBe(17.5);
    expect(json.recordedOn).toBe('2026-06-07');
  });

  it('maps camelCase fields to snake_case columns in the upsert', async () => {
    const upsertSpy = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: FULL_ROW, error: null }),
      }),
    });
    const supabase: any = { from: vi.fn().mockReturnValue({ upsert: upsertSpy }) };
    mockRequireUser.mockResolvedValueOnce({ supabase, user: { id: USER_ID } as any });

    await PATCH(makeRequest({ bodyFatPct: 17.5, waistCm: 83.8 }));

    expect(upsertSpy).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: USER_ID, body_fat_pct: 17.5, waist_cm: 83.8 }),
      { onConflict: 'user_id,recorded_on', ignoreDuplicates: false },
    );
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm test -- app/api/measurements/route.test.ts`
Expected: FAIL — `Cannot find module './route'`.

- [ ] **Step 3: Implement `app/api/measurements/route.ts`**

```ts
import { requireUser } from '@/lib/api/auth';
import { handleApiError, jsonOk } from '@/lib/api/responses';
import { upsertTodayMeasurements, todayUtc } from '@/lib/body-metrics/server';
import { measurementsPatchBodySchema, type MeasurementsDTO } from '@/lib/schemas/body-metrics';

export const runtime = 'nodejs';

const CAMEL_TO_SNAKE: Record<string, string> = {
  bodyFatPct: 'body_fat_pct',
  waistCm: 'waist_cm',
  chestCm: 'chest_cm',
  armsCm: 'arms_cm',
  legsCm: 'legs_cm',
};

export async function PATCH(request: Request): Promise<Response> {
  try {
    const { supabase, user } = await requireUser();
    const body = measurementsPatchBodySchema.parse(await request.json());

    const fields: Record<string, number | null> = {};
    for (const [k, v] of Object.entries(body)) {
      const col = CAMEL_TO_SNAKE[k];
      if (col !== undefined) fields[col] = v as number | null;
    }

    const dto = await upsertTodayMeasurements(supabase, user.id, fields, todayUtc());
    return jsonOk<MeasurementsDTO>(dto);
  } catch (err) {
    return handleApiError(err);
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm test -- app/api/measurements/route.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/api/measurements/route.ts app/api/measurements/route.test.ts
git commit -m "feat(body-metrics): add PATCH /api/measurements upsert route"
```

---

## Task 8: Mutation hooks

**Files:**

- Create: `features/profile/hooks/useLogBodyweightMutation.ts`
- Create: `features/profile/hooks/useUpdateMeasurementsMutation.ts`

- [ ] **Step 1: Implement `useLogBodyweightMutation.ts`**

```ts
'use client';

import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';

import type { BodyweightEntryDTO } from '@/lib/schemas/body-metrics';

export function useLogBodyweightMutation() {
  return useMutation<BodyweightEntryDTO, Error, { weightKg: number }>({
    mutationFn: async (body) => {
      const res = await fetch('/api/bodyweight', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        let message = `HTTP ${res.status}`;
        try {
          const json = (await res.json()) as { error?: { message?: string } };
          if (json.error?.message) message = json.error.message;
        } catch {
          // ignore parse errors
        }
        throw new Error(message);
      }

      return (await res.json()) as BodyweightEntryDTO;
    },
    onSuccess: () => {
      toast.success('Weight logged');
    },
    onError: () => {
      toast.error('Failed to log weight');
    },
  });
}
```

- [ ] **Step 2: Implement `useUpdateMeasurementsMutation.ts`**

```ts
'use client';

import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';

import type { MeasurementsDTO, MeasurementsPatchBody } from '@/lib/schemas/body-metrics';

export function useUpdateMeasurementsMutation() {
  return useMutation<MeasurementsDTO, Error, MeasurementsPatchBody>({
    mutationFn: async (patch) => {
      const res = await fetch('/api/measurements', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });

      if (!res.ok) {
        let message = `HTTP ${res.status}`;
        try {
          const json = (await res.json()) as { error?: { message?: string } };
          if (json.error?.message) message = json.error.message;
        } catch {
          // ignore parse errors
        }
        throw new Error(message);
      }

      return (await res.json()) as MeasurementsDTO;
    },
    onSuccess: () => {
      toast.success('Measurements saved');
    },
    onError: () => {
      toast.error('Failed to save measurements');
    },
  });
}
```

- [ ] **Step 3: Type-check**

Run: `pnpm type-check`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add features/profile/hooks/useLogBodyweightMutation.ts features/profile/hooks/useUpdateMeasurementsMutation.ts
git commit -m "feat(body-metrics): add bodyweight + measurements mutation hooks"
```

---

## Task 9: BmiCard component

**Files:**

- Create: `features/profile/components/BmiCard.tsx`

Presentational (no `'use client'`). Receives precomputed BMI + category. Scale bar runs 15→35; marker left% = clamp `((bmi - 15) / 20) * 100`. Category pill colour keyed by `category.key` (underweight=blue, normal=emerald, overweight=amber, obese=red).

- [ ] **Step 1: Implement `BmiCard.tsx`**

```tsx
import { Scale } from 'lucide-react';

import { cn } from '@/lib/utils';
import type { BmiCategory } from '@/lib/body-metrics/derive';

const SCALE_MIN = 15;
const SCALE_MAX = 35;
const TICKS = [15, 18.5, 25, 30, 35];

const PILL_BY_KEY: Record<BmiCategory['key'], string> = {
  underweight: 'bg-blue-500/15 text-blue-400',
  normal: 'bg-emerald-500/15 text-emerald-400',
  overweight: 'bg-amber-500/15 text-amber-400',
  obese: 'bg-red-500/15 text-red-400',
};

export interface BmiCardProps {
  bmi: number | null;
  category: BmiCategory | null;
  /** e.g. `5'10"` or `178 cm` */
  heightLabel: string | null;
  /** e.g. `186.4 lbs` or `84.5 kg` */
  weightLabel: string | null;
}

export function BmiCard({ bmi, category, heightLabel, weightLabel }: BmiCardProps) {
  const markerPct =
    bmi === null
      ? 0
      : Math.min(100, Math.max(0, ((bmi - SCALE_MIN) / (SCALE_MAX - SCALE_MIN)) * 100));

  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        <Scale className="h-4 w-4" />
        Body Mass Index
      </div>

      {bmi === null || category === null ? (
        <p className="mt-4 text-sm text-muted-foreground">
          Add your height in Personal info and log a weight to see your BMI.
        </p>
      ) : (
        <>
          <div className="mt-2 flex items-center gap-4">
            <span className="text-5xl font-bold leading-none tracking-tight">{bmi.toFixed(1)}</span>
            <span
              className={cn(
                'rounded-full px-3 py-1 text-sm font-semibold',
                PILL_BY_KEY[category.key],
              )}
            >
              {category.label}
            </span>
          </div>

          {heightLabel && weightLabel ? (
            <p className="mt-3 text-sm text-muted-foreground">
              Based on {heightLabel} · {weightLabel}
            </p>
          ) : null}

          <div className="mt-5">
            <div className="relative h-2 rounded-full bg-gradient-to-r from-blue-500 via-amber-500 via-emerald-500 to-red-500">
              <span
                className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-background bg-amber-400 shadow"
                style={{ left: `${markerPct}%` }}
                aria-hidden
              />
            </div>
            <div className="mt-2 flex justify-between text-xs text-muted-foreground">
              {TICKS.map((t) => (
                <span key={t}>{t}</span>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `pnpm type-check`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add features/profile/components/BmiCard.tsx
git commit -m "feat(body-metrics): add BmiCard with category pill and scale bar"
```

---

## Task 10: WeightChart component (recharts)

**Files:**

- Create: `features/profile/components/WeightChart.tsx`

Client component. Takes already-converted display points `{ date: string; weight: number }[]` plus a unit label, so all kg→display conversion happens in the parent (`BodyweightSection`). Orange line + soft area fill, sparse date ticks.

- [ ] **Step 1: Implement `WeightChart.tsx`**

```tsx
'use client';

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

const BRAND = '#e85500';

export interface WeightChartPoint {
  date: string; // YYYY-MM-DD
  weight: number; // already in display unit
}

export interface WeightChartProps {
  points: WeightChartPoint[];
  unitLabel: string; // 'lbs' | 'kg'
}

function formatTick(date: string): string {
  const d = new Date(date);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function WeightChart({ points, unitLabel }: WeightChartProps) {
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="weight-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={BRAND} stopOpacity={0.35} />
              <stop offset="100%" stopColor={BRAND} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeOpacity={0.4} />
          <XAxis
            dataKey="date"
            tickFormatter={formatTick}
            tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
            tickLine={false}
            axisLine={false}
            minTickGap={32}
          />
          <YAxis
            width={32}
            domain={['dataMin - 2', 'dataMax + 2']}
            tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            formatter={(value: number) => [`${value} ${unitLabel}`, 'Weight']}
            labelFormatter={(label: string) => formatTick(label)}
            contentStyle={{
              background: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
              borderRadius: 8,
              fontSize: 12,
            }}
          />
          <Area
            type="monotone"
            dataKey="weight"
            stroke={BRAND}
            strokeWidth={2}
            fill="url(#weight-fill)"
            dot={{ r: 3, fill: BRAND, strokeWidth: 0 }}
            activeDot={{ r: 4 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `pnpm type-check`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add features/profile/components/WeightChart.tsx
git commit -m "feat(body-metrics): add WeightChart (recharts area chart)"
```

---

## Task 11: BodyweightSection (current + delta + chart + log form)

**Files:**

- Create: `features/profile/components/BodyweightSection.tsx`

Client component. Computes CURRENT (last entry), trend pill via `weightDelta`, builds chart points (kg→display), and renders the "Log today's weight" input + "Add entry" using `useLogBodyweightMutation`, calling `router.refresh()` on success.

- [ ] **Step 1: Implement `BodyweightSection.tsx`**

```tsx
'use client';

import { TrendingDown, TrendingUp } from 'lucide-react';
import { useRouter } from 'next/navigation';
import * as React from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { weightDelta } from '@/lib/body-metrics/derive';
import type { BodyweightEntryDTO } from '@/lib/schemas/body-metrics';

import { useLogBodyweightMutation } from '../hooks/useLogBodyweightMutation';
import { kgToLbs, lbsToKg } from '../lib/unitConversions';
import { WeightChart } from './WeightChart';

type WeightUnit = 'lbs' | 'kg';

function toDisplay(kg: number, unit: WeightUnit): number {
  return unit === 'lbs' ? kgToLbs(kg) : Math.round(kg * 10) / 10;
}

export interface BodyweightSectionProps {
  entries: BodyweightEntryDTO[];
  weightUnit: WeightUnit;
}

export function BodyweightSection({ entries, weightUnit }: BodyweightSectionProps) {
  const router = useRouter();
  const mutation = useLogBodyweightMutation();
  const [value, setValue] = React.useState('');

  const sorted = React.useMemo(
    () => [...entries].sort((a, b) => a.recordedOn.localeCompare(b.recordedOn)),
    [entries],
  );
  const current = sorted.at(-1) ?? null;
  const delta = weightDelta(entries);

  const points = sorted.map((e) => ({
    date: e.recordedOn,
    weight: toDisplay(e.weightKg, weightUnit),
  }));
  const currentDisplay = current ? toDisplay(current.weightKg, weightUnit) : null;
  const deltaDisplay = delta ? toDisplay(Math.abs(delta.deltaKg), weightUnit) : null;
  const isLoss = delta ? delta.deltaKg < 0 : false;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const n = Number(value);
    if (isNaN(n) || n <= 0) return;
    const weightKg = weightUnit === 'lbs' ? lbsToKg(n) : n;
    mutation.mutate(
      { weightKg },
      {
        onSuccess: () => {
          setValue('');
          router.refresh();
        },
      },
    );
  }

  return (
    <section>
      <div className="mb-3 flex items-end justify-between">
        <h2 className="text-lg font-semibold">Bodyweight</h2>
        <span className="text-sm text-muted-foreground">{entries.length} entries</span>
      </div>

      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Current
            </p>
            <p className="mt-1 text-3xl font-bold leading-none">
              {currentDisplay ?? '—'}
              {currentDisplay !== null ? (
                <span className="ml-1 text-base font-normal text-muted-foreground">
                  {weightUnit}
                </span>
              ) : null}
            </p>
          </div>
          {delta && deltaDisplay !== null ? (
            <span
              className={cn(
                'inline-flex items-center gap-1 rounded-full border px-3 py-1 text-sm font-semibold',
                isLoss
                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                  : 'border-amber-500/30 bg-amber-500/10 text-amber-400',
              )}
            >
              {isLoss ? <TrendingDown className="h-4 w-4" /> : <TrendingUp className="h-4 w-4" />}
              {isLoss ? '-' : '+'}
              {deltaDisplay} {weightUnit} · {delta.weeks} wk
            </span>
          ) : null}
        </div>

        {points.length > 0 ? (
          <div className="mt-4">
            <WeightChart points={points} unitLabel={weightUnit} />
          </div>
        ) : (
          <p className="mt-4 text-sm text-muted-foreground">Log a few entries to see your trend.</p>
        )}

        <form onSubmit={handleSubmit} className="mt-6 border-t border-border pt-6">
          <label htmlFor="log-weight" className="block text-base font-medium">
            Log today&rsquo;s weight
          </label>
          <div className="mt-3 flex items-center gap-3">
            <Input
              id="log-weight"
              type="number"
              inputMode="decimal"
              min={0}
              step="0.1"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={currentDisplay !== null ? String(currentDisplay) : '0'}
              aria-label="Today's weight"
            />
            <span className="shrink-0 text-sm text-muted-foreground">{weightUnit}</span>
            <Button type="submit" disabled={value.trim() === '' || mutation.isPending}>
              {mutation.isPending ? 'Saving…' : '+ Add entry'}
            </Button>
          </div>
        </form>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `pnpm type-check`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add features/profile/components/BodyweightSection.tsx
git commit -m "feat(body-metrics): add BodyweightSection with chart and log form"
```

---

## Task 12: MeasurementsForm

**Files:**

- Create: `features/profile/components/MeasurementsForm.tsx`

Client component. Body fat is a plain `%`. Waist/Chest/Arms/Legs are lengths stored in cm; displayed in inches when `heightUnit === 'ft'`, else cm. Uses `inToCm`/`cmToIn`. Tracks a `saved` snapshot for dirty/cancel, submits only via "Save measurements", and `router.refresh()` on success.

- [ ] **Step 1: Implement `MeasurementsForm.tsx`**

```tsx
'use client';

import { useRouter } from 'next/navigation';
import * as React from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { MeasurementsDTO } from '@/lib/schemas/body-metrics';

import { useUpdateMeasurementsMutation } from '../hooks/useUpdateMeasurementsMutation';
import { cmToIn, inToCm } from '../lib/unitConversions';
import { Field } from './ui/Field';

type HeightUnit = 'ft' | 'cm';

function lengthToDisplay(cm: number | null, imperial: boolean): string {
  if (cm === null) return '';
  return imperial ? String(cmToIn(cm)) : String(Math.round(cm * 10) / 10);
}

function displayToCm(val: string, imperial: boolean): number | null {
  if (val.trim() === '') return null;
  const n = Number(val);
  if (isNaN(n) || n <= 0) return null;
  return imperial ? inToCm(n) : Math.round(n * 10) / 10;
}

export interface MeasurementsFormProps {
  measurements: MeasurementsDTO | null;
  heightUnit: HeightUnit;
}

export function MeasurementsForm({ measurements, heightUnit }: MeasurementsFormProps) {
  const router = useRouter();
  const mutation = useUpdateMeasurementsMutation();
  const imperial = heightUnit === 'ft';
  const lengthUnit = imperial ? 'in' : 'cm';

  const initial = React.useMemo(
    () => ({
      bodyFat:
        measurements?.bodyFatPct === null || measurements === null
          ? ''
          : String(measurements.bodyFatPct),
      waist: lengthToDisplay(measurements?.waistCm ?? null, imperial),
      chest: lengthToDisplay(measurements?.chestCm ?? null, imperial),
      arms: lengthToDisplay(measurements?.armsCm ?? null, imperial),
      legs: lengthToDisplay(measurements?.legsCm ?? null, imperial),
    }),
    [measurements, imperial],
  );

  const [form, setForm] = React.useState(initial);
  const [saved, setSaved] = React.useState(initial);

  const isDirty = (Object.keys(form) as Array<keyof typeof form>).some((k) => form[k] !== saved[k]);

  function set(key: keyof typeof form, val: string) {
    setForm((prev) => ({ ...prev, [key]: val }));
  }

  function handleCancel() {
    setForm(saved);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const bodyFat = form.bodyFat.trim() === '' ? null : Number(form.bodyFat);
    mutation.mutate(
      {
        bodyFatPct: bodyFat,
        waistCm: displayToCm(form.waist, imperial),
        chestCm: displayToCm(form.chest, imperial),
        armsCm: displayToCm(form.arms, imperial),
        legsCm: displayToCm(form.legs, imperial),
      },
      {
        onSuccess: () => {
          setSaved(form);
          router.refresh();
        },
      },
    );
  }

  return (
    <section>
      <h2 className="mb-3 text-lg font-semibold">Measurements</h2>
      <form onSubmit={handleSubmit} noValidate className="rounded-xl border border-border bg-card">
        <div className="grid grid-cols-2 gap-x-6 gap-y-6 p-6 lg:grid-cols-3">
          <Field label="Body fat">
            <div className="flex items-center gap-2">
              <Input
                type="number"
                inputMode="decimal"
                min={0}
                max={100}
                step="0.1"
                value={form.bodyFat}
                onChange={(e) => set('bodyFat', e.target.value)}
                aria-label="Body fat percentage"
              />
              <span className="shrink-0 text-sm text-muted-foreground">%</span>
            </div>
          </Field>

          {(
            [
              ['waist', 'Waist'],
              ['chest', 'Chest'],
              ['arms', 'Arms'],
              ['legs', 'Legs'],
            ] as Array<[keyof typeof form, string]>
          ).map(([key, label]) => (
            <Field key={key} label={label}>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="0.1"
                  value={form[key]}
                  onChange={(e) => set(key, e.target.value)}
                  aria-label={`${label} measurement`}
                />
                <span className="shrink-0 text-sm text-muted-foreground">{lengthUnit}</span>
              </div>
            </Field>
          ))}
        </div>

        <div className="flex justify-end gap-3 border-t border-border px-6 py-4">
          <Button
            type="button"
            variant="ghost"
            disabled={!isDirty || mutation.isPending}
            onClick={handleCancel}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={!isDirty || mutation.isPending}>
            {mutation.isPending ? 'Saving…' : 'Save measurements'}
          </Button>
        </div>
      </form>
    </section>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `pnpm type-check`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add features/profile/components/MeasurementsForm.tsx
git commit -m "feat(body-metrics): add MeasurementsForm with in/cm unit handling"
```

---

## Task 13: ProgressPhotosPlaceholder

**Files:**

- Create: `features/profile/components/ProgressPhotosPlaceholder.tsx`

Static stub — no logic.

- [ ] **Step 1: Implement `ProgressPhotosPlaceholder.tsx`**

```tsx
import { Camera } from 'lucide-react';

export function ProgressPhotosPlaceholder() {
  return (
    <section>
      <h2 className="mb-3 text-lg font-semibold">Progress photos</h2>
      <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border bg-card px-6 py-12 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-secondary text-muted-foreground">
          <Camera className="h-5 w-5" />
        </span>
        <p className="text-base font-medium">Visual progress timeline</p>
        <p className="text-sm text-muted-foreground">
          Track changes with side-by-side photos over time.
        </p>
        <span className="rounded-full bg-brand/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-brand">
          Coming soon
        </span>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `pnpm type-check`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add features/profile/components/ProgressPhotosPlaceholder.tsx
git commit -m "feat(body-metrics): add Progress photos placeholder"
```

---

## Task 14: Page wiring + barrel exports

**Files:**

- Modify: `features/profile/index.ts`
- Modify: `app/(app)/profile/body-metrics/page.tsx`

- [ ] **Step 1: Add barrel exports**

Append to `features/profile/index.ts`:

```ts
export { BmiCard } from './components/BmiCard';
export { BodyweightSection } from './components/BodyweightSection';
export { MeasurementsForm } from './components/MeasurementsForm';
export { ProgressPhotosPlaceholder } from './components/ProgressPhotosPlaceholder';
```

- [ ] **Step 2: Implement the page**

Replace the stub in `app/(app)/profile/body-metrics/page.tsx`:

```tsx
import {
  BmiCard,
  BodyweightSection,
  MeasurementsForm,
  ProgressPhotosPlaceholder,
} from '@/features/profile';
import { cmToFtIn, kgToLbs } from '@/features/profile/lib/unitConversions';
import { bmiCategory, computeBmi } from '@/lib/body-metrics/derive';
import { getBodyweightEntries, getLatestMeasurements } from '@/lib/body-metrics/server';
import { getOrCreateProfile } from '@/lib/profile';
import { createSupabaseServerClient } from '@/lib/supabase/server-exports';

export default async function BodyMetricsPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const [profile, settingsResult, entries, measurements] = await Promise.all([
    getOrCreateProfile(supabase, user.id),
    supabase
      .from('user_settings')
      .select('weight_unit, height_unit')
      .eq('user_id', user.id)
      .maybeSingle(),
    getBodyweightEntries(supabase, user.id),
    getLatestMeasurements(supabase, user.id),
  ]);

  const weightUnit: 'lbs' | 'kg' = settingsResult.data?.weight_unit ?? 'lbs';
  const heightUnit: 'ft' | 'cm' = settingsResult.data?.height_unit ?? 'ft';

  // BMI uses the latest logged weight, falling back to the profile's starting weight.
  const latestWeightKg =
    entries.length > 0 ? entries[entries.length - 1].weightKg : profile.startingWeightKg;
  const bmi = computeBmi(profile.heightCm, latestWeightKg);
  const category = bmi === null ? null : bmiCategory(bmi);

  let heightLabel: string | null = null;
  if (profile.heightCm !== null) {
    if (heightUnit === 'ft') {
      const { ft, in: inches } = cmToFtIn(profile.heightCm);
      heightLabel = `${ft}'${inches}"`;
    } else {
      heightLabel = `${Math.round(profile.heightCm)} cm`;
    }
  }

  let weightLabel: string | null = null;
  if (latestWeightKg !== null) {
    weightLabel =
      weightUnit === 'lbs'
        ? `${kgToLbs(latestWeightKg)} lbs`
        : `${Math.round(latestWeightKg * 10) / 10} kg`;
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold">Body metrics</h1>
        <p className="mt-1 text-sm text-muted-foreground">Track your composition over time.</p>
      </div>

      <BmiCard bmi={bmi} category={category} heightLabel={heightLabel} weightLabel={weightLabel} />
      <BodyweightSection entries={entries} weightUnit={weightUnit} />
      <MeasurementsForm measurements={measurements} heightUnit={heightUnit} />
      <ProgressPhotosPlaceholder />
    </div>
  );
}
```

- [ ] **Step 3: Type-check, lint, format**

Run: `pnpm type-check && pnpm lint && pnpm format`
Expected: type-check PASS, 0 lint errors, format clean.

- [ ] **Step 4: Run it in the browser**

Run `pnpm dev`, visit `/profile/body-metrics`, and verify against the mockups (mobile + desktop): BMI card value/pill/scale marker, the weight chart + current/trend pill, logging today's weight updates the chart after save, and saving measurements persists in the chosen unit.

- [ ] **Step 5: Commit**

```bash
git add features/profile/index.ts "app/(app)/profile/body-metrics/page.tsx"
git commit -m "feat(profile): wire up Body metrics page (/profile/body-metrics)"
```

---

## Self-Review notes

- **Spec coverage:** migration (Task 1) ✓; schemas+DTOs (Task 4) ✓; server helpers (Task 5) ✓; derive BMI/category/delta (Task 2) ✓; in/cm helpers (Task 3) ✓; POST /api/bodyweight (Task 6) ✓; PATCH /api/measurements (Task 7) ✓; hooks (Task 8) ✓; BmiCard (Task 9) ✓; WeightChart (Task 10) ✓; BodyweightSection (Task 11) ✓; MeasurementsForm (Task 12) ✓; ProgressPhotosPlaceholder (Task 13) ✓; page + exports (Task 14) ✓.
- **Type consistency:** `BodyweightEntryDTO` (`id`, `weightKg`, `recordedOn`) and `MeasurementsDTO` (`bodyFatPct`, `waistCm`, `chestCm`, `armsCm`, `legsCm`, `recordedOn`) are used identically across schemas, server, routes, hooks, and components. Upsert `onConflict` is the string `'user_id,recorded_on'` everywhere. `bmiCategory().key` values (`underweight|normal|overweight|obese`) match `BmiCard`'s `PILL_BY_KEY`.
- **Open follow-up (not in scope):** "today" is UTC; a `profiles.time_zone`-aware date is a future refinement noted in the migration comment. Progress photos remain a stub.

```

```
