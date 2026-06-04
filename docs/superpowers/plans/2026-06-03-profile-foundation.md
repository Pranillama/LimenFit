# Profile Foundation + Shell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the data foundation (schema + types + API) and the visible profile shell (header, master/detail desktop layout, mobile push routes, Account inline section with password reset + delete account, Sign Out), so each follow-up plan (Personal, Fitness, Body Metrics, Preferences, Subscription) can plug into established hooks and components.

**Architecture:**
- New `public.profiles` table holds identity + fitness fields, separate from `public.user_settings` which keeps display preferences (weight unit, rest timer, and the new height unit). All bodyweight/measurement values store canonically in kg/cm; UI converts at render time.
- Per-route sub-pages under `app/(app)/profile/*` driven by a shared `layout.tsx`: on `lg` and up, layout renders the master-detail grid with section list as a sticky left rail; on mobile, the same routes are full screens with an iOS-style CSS slide transition.
- Shared profile primitives (`Segmented`, `Pill`, `IconChip`, `SectionRow`, `Field`) live under `features/profile/components/ui/` and wrap existing shadcn primitives. Brand orange added to Tailwind for accent-only use; primary CTAs stay near-white.
- Sub-page stubs are created in this plan so the routes exist and section navigation works; their full content is built in follow-up plans.

**Tech Stack:** Next.js 15 App Router (RSC), TypeScript, Tailwind, shadcn/ui (existing), Supabase (Postgres + auth + RLS), TanStack Query, Zod, react-hook-form (introduced when forms ship), Vitest.

---

## File structure

**New:**
- `supabase/migrations/20260603000001_profiles.sql`
- `lib/schemas/profile.ts`
- `lib/profile/server.ts`
- `lib/profile/index.ts`
- `app/api/profile/route.ts`
- `app/api/profile/route.test.ts`
- `app/api/account/delete/route.ts`
- `app/api/account/delete/route.test.ts`
- `features/profile/components/ui/Segmented.tsx`
- `features/profile/components/ui/Pill.tsx`
- `features/profile/components/ui/IconChip.tsx`
- `features/profile/components/ui/SectionRow.tsx`
- `features/profile/components/ui/Field.tsx`
- `features/profile/components/ProfileHeader.tsx`
- `features/profile/components/SectionList.tsx`
- `features/profile/components/AccountSection.tsx`
- `features/profile/components/DeleteAccountDialog.tsx`
- `features/profile/components/ChangePasswordRow.tsx`
- `features/profile/hooks/useChangePassword.ts`
- `features/profile/hooks/useDeleteAccount.ts`
- `app/(app)/profile/layout.tsx`
- `app/(app)/profile/personal/page.tsx`
- `app/(app)/profile/fitness/page.tsx`
- `app/(app)/profile/body-metrics/page.tsx`
- `app/(app)/profile/preferences/page.tsx`
- `app/(app)/profile/subscription/page.tsx`

**Modify:**
- `tailwind.config.ts` (add `brand` color scale)
- `lib/supabase/types.ts` (regenerated/hand-edited to include `profiles` table + new enums + new `height_unit` column on `user_settings`)
- `app/(app)/profile/page.tsx` (renders new landing — header + SectionList; the previous body moves into the new shell)
- `features/profile/index.ts` (re-exports new components)
- `features/profile/components/ProfileView.tsx` (rewritten as the landing — uses Header + SectionList + AccountSection + SignOutButton)

**Leave alone (still wired through to /profile/preferences in a future plan):**
- `features/profile/components/SettingsForm.tsx`
- `features/profile/components/AccountInfo.tsx`
- `features/profile/hooks/useUpdateSettingsMutation.ts`

---

## Task 1: Add `brand` color scale to Tailwind

**Files:**
- Modify: `tailwind.config.ts:48`

- [ ] **Step 1: Edit tailwind.config.ts to replace `brand-orange` literal with a `brand` scale**

Replace `'brand-orange': '#e85500',` with the brand scale (keep the existing `brand-orange` literal for backwards-compat with any current usage):

```ts
'brand-orange': '#e85500',
brand: {
  DEFAULT: '#e85500',
  600: '#cc4a00',
},
```

- [ ] **Step 2: Verify types compile**

Run: `pnpm type-check`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add tailwind.config.ts
git commit -m "feat(theme): add brand color scale for profile accents"
```

---

## Task 2: Profiles migration — enums + table + RLS

**Files:**
- Create: `supabase/migrations/20260603000001_profiles.sql`

- [ ] **Step 1: Write the migration**

```sql
-- New enums for profile fields
CREATE TYPE height_unit          AS ENUM ('ft', 'cm');
CREATE TYPE fitness_goal         AS ENUM ('fat_loss', 'muscle_gain', 'strength', 'endurance', 'general_fitness');
CREATE TYPE activity_level       AS ENUM ('sedentary', 'lightly_active', 'moderately_active', 'very_active');
CREATE TYPE training_experience  AS ENUM ('beginner', 'intermediate', 'advanced');
CREATE TYPE gender               AS ENUM ('male', 'female', 'prefer_not_to_say');

-- Extend user_settings with display height unit; weight unit + rest timer remain.
ALTER TABLE public.user_settings
  ADD COLUMN height_unit height_unit NOT NULL DEFAULT 'ft';

-- profiles: one row per user, holds identity + fitness fields.
-- All weight values stored in kg, all heights in cm. Display conversion is client-side.
CREATE TABLE public.profiles (
  id                          uuid                PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                     uuid                NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Personal info
  first_name                  text,
  last_name                   text,
  display_name                text,
  username                    text                UNIQUE,
  avatar_url                  text,
  date_of_birth               date,
  gender                      gender,
  height_cm                   numeric(5,2),
  starting_weight_kg          numeric(6,2),
  time_zone                   text,

  -- Fitness profile
  primary_goal                fitness_goal,
  goal_weight_kg              numeric(6,2),
  target_daily_calories       integer,
  activity_level              activity_level,
  training_experience         training_experience,
  weekly_training_frequency   smallint            CHECK (weekly_training_frequency BETWEEN 2 AND 6),

  created_at                  timestamptz         NOT NULL DEFAULT now(),
  updated_at                  timestamptz         NOT NULL DEFAULT now()
);

CREATE TRIGGER set_updated_at_profiles
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY profiles_select ON public.profiles
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY profiles_insert ON public.profiles
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY profiles_update ON public.profiles
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY profiles_delete ON public.profiles
  FOR DELETE USING (user_id = auth.uid());
```

- [ ] **Step 2: Reset the local database to apply the migration cleanly**

Run: `pnpm db:reset`
Expected: Migration applies without error; last log line shows `Finished supabase db reset`.

- [ ] **Step 3: Smoke-check the table exists**

Run:
```bash
docker exec -i supabase_db_LimenFit psql -U postgres -d postgres -c "\d public.profiles" 2>/dev/null || \
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -c "\d public.profiles"
```
Expected: Table description listing every column above.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260603000001_profiles.sql
git commit -m "feat(db): add profiles table, fitness/identity enums, user_settings.height_unit"
```

---

## Task 3: Regenerate Database types

**Files:**
- Modify: `lib/supabase/types.ts`

- [ ] **Step 1: Regenerate types from the local database**

Run: `pnpm dlx supabase gen types typescript --local > lib/supabase/types.ts`
Expected: File rewritten; no errors.

If the CLI isn't available, hand-edit `lib/supabase/types.ts` to add:
- `profiles` Tables entry mirroring the Row/Insert/Update shape (see Task 2 columns)
- `height_unit` Enum: `'ft' | 'cm'`
- `fitness_goal`, `activity_level`, `training_experience`, `gender` Enums
- Add `height_unit: Database["public"]["Enums"]["height_unit"]` to existing `user_settings` Row/Insert/Update

- [ ] **Step 2: Type-check the project**

Run: `pnpm type-check`
Expected: PASS. If failures point at `user_settings` server reads not selecting `height_unit`, ignore for now — Task 4 introduces the profile-side server helper; existing `lib/settings/server.ts` only reads weight_unit/rest_timer and continues to work.

- [ ] **Step 3: Commit**

```bash
git add lib/supabase/types.ts
git commit -m "chore(db-types): regenerate types for profiles table and new enums"
```

---

## Task 4: Zod schemas for the profile DTO

**Files:**
- Create: `lib/schemas/profile.ts`

- [ ] **Step 1: Write the failing test**

Create `lib/schemas/__tests__/profile.test.ts`:

```ts
import { describe, it, expect } from 'vitest';

import { profilePatchBodySchema, type ProfileDTO } from '@/lib/schemas/profile';

describe('profilePatchBodySchema', () => {
  it('accepts an empty patch is rejected (at least one field required)', () => {
    const result = profilePatchBodySchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('accepts a single-field patch (firstName)', () => {
    const result = profilePatchBodySchema.safeParse({ firstName: 'Ada' });
    expect(result.success).toBe(true);
  });

  it('rejects an invalid primaryGoal enum', () => {
    const result = profilePatchBodySchema.safeParse({ primaryGoal: 'bulking' });
    expect(result.success).toBe(false);
  });

  it('rejects weeklyTrainingFrequency below 2 or above 6', () => {
    expect(profilePatchBodySchema.safeParse({ weeklyTrainingFrequency: 1 }).success).toBe(false);
    expect(profilePatchBodySchema.safeParse({ weeklyTrainingFrequency: 7 }).success).toBe(false);
    expect(profilePatchBodySchema.safeParse({ weeklyTrainingFrequency: 4 }).success).toBe(true);
  });

  it('accepts a fully populated patch', () => {
    const body = {
      firstName: 'Ada',
      lastName: 'Lovelace',
      username: 'ada',
      heightCm: 170.5,
      startingWeightKg: 65,
      gender: 'prefer_not_to_say',
      primaryGoal: 'general_fitness',
      activityLevel: 'moderately_active',
      trainingExperience: 'intermediate',
      weeklyTrainingFrequency: 4,
    } satisfies Partial<ProfileDTO>;
    expect(profilePatchBodySchema.safeParse(body).success).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test, expect failure**

Run: `pnpm test -- lib/schemas/__tests__/profile.test.ts`
Expected: FAIL — cannot import from `@/lib/schemas/profile`.

- [ ] **Step 3: Write `lib/schemas/profile.ts`**

```ts
import { z } from 'zod';

import type { Database } from '@/lib/supabase/types';

type FitnessGoal = Database['public']['Enums']['fitness_goal'];
type ActivityLevel = Database['public']['Enums']['activity_level'];
type TrainingExperience = Database['public']['Enums']['training_experience'];
type Gender = Database['public']['Enums']['gender'];

export const FITNESS_GOALS = [
  'fat_loss',
  'muscle_gain',
  'strength',
  'endurance',
  'general_fitness',
] as const satisfies readonly [FitnessGoal, ...FitnessGoal[]];

export const ACTIVITY_LEVELS = [
  'sedentary',
  'lightly_active',
  'moderately_active',
  'very_active',
] as const satisfies readonly [ActivityLevel, ...ActivityLevel[]];

export const TRAINING_EXPERIENCES = [
  'beginner',
  'intermediate',
  'advanced',
] as const satisfies readonly [TrainingExperience, ...TrainingExperience[]];

export const GENDERS = [
  'male',
  'female',
  'prefer_not_to_say',
] as const satisfies readonly [Gender, ...Gender[]];

const nullableTrimmedText = z
  .string()
  .trim()
  .max(120)
  .nullable()
  .or(z.string().trim().max(120).transform((v) => (v.length === 0 ? null : v)));

export const profilePatchBodySchema = z
  .object({
    firstName: nullableTrimmedText.optional(),
    lastName: nullableTrimmedText.optional(),
    displayName: nullableTrimmedText.optional(),
    username: z.string().trim().min(2).max(32).regex(/^[a-z0-9_.-]+$/i).nullable().optional(),
    avatarUrl: z.string().url().max(2048).nullable().optional(),
    dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
    gender: z.enum(GENDERS).nullable().optional(),
    heightCm: z.number().positive().max(300).nullable().optional(),
    startingWeightKg: z.number().positive().max(500).nullable().optional(),
    timeZone: z.string().max(64).nullable().optional(),
    primaryGoal: z.enum(FITNESS_GOALS).nullable().optional(),
    goalWeightKg: z.number().positive().max(500).nullable().optional(),
    targetDailyCalories: z.number().int().positive().max(20000).nullable().optional(),
    activityLevel: z.enum(ACTIVITY_LEVELS).nullable().optional(),
    trainingExperience: z.enum(TRAINING_EXPERIENCES).nullable().optional(),
    weeklyTrainingFrequency: z.number().int().min(2).max(6).nullable().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Patch must contain at least one field',
  });

export type ProfilePatchBody = z.infer<typeof profilePatchBodySchema>;

export type ProfileDTO = {
  firstName: string | null;
  lastName: string | null;
  displayName: string | null;
  username: string | null;
  avatarUrl: string | null;
  dateOfBirth: string | null;
  gender: Gender | null;
  heightCm: number | null;
  startingWeightKg: number | null;
  timeZone: string | null;
  primaryGoal: FitnessGoal | null;
  goalWeightKg: number | null;
  targetDailyCalories: number | null;
  activityLevel: ActivityLevel | null;
  trainingExperience: TrainingExperience | null;
  weeklyTrainingFrequency: number | null;
};
```

- [ ] **Step 4: Run the test, expect pass**

Run: `pnpm test -- lib/schemas/__tests__/profile.test.ts`
Expected: PASS, all 5 cases.

- [ ] **Step 5: Commit**

```bash
git add lib/schemas/profile.ts lib/schemas/__tests__/profile.test.ts
git commit -m "feat(schemas): add profilePatchBodySchema and ProfileDTO"
```

---

## Task 5: Server helper — `getOrCreateProfile`

**Files:**
- Create: `lib/profile/server.ts`
- Create: `lib/profile/index.ts`

- [ ] **Step 1: Write `lib/profile/server.ts`**

```ts
import type { SupabaseClient } from '@supabase/supabase-js';

import { assertServerOnly } from '@/lib/env';
import type { Database } from '@/lib/supabase/types';
import type { ProfileDTO } from '@/lib/schemas/profile';

assertServerOnly();

const PROFILE_COLUMNS =
  'first_name, last_name, display_name, username, avatar_url, date_of_birth, gender, ' +
  'height_cm, starting_weight_kg, time_zone, primary_goal, goal_weight_kg, ' +
  'target_daily_calories, activity_level, training_experience, weekly_training_frequency';

type ProfileRow = {
  first_name: string | null;
  last_name: string | null;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
  date_of_birth: string | null;
  gender: Database['public']['Enums']['gender'] | null;
  height_cm: number | null;
  starting_weight_kg: number | null;
  time_zone: string | null;
  primary_goal: Database['public']['Enums']['fitness_goal'] | null;
  goal_weight_kg: number | null;
  target_daily_calories: number | null;
  activity_level: Database['public']['Enums']['activity_level'] | null;
  training_experience: Database['public']['Enums']['training_experience'] | null;
  weekly_training_frequency: number | null;
};

function rowToDTO(row: ProfileRow): ProfileDTO {
  return {
    firstName: row.first_name,
    lastName: row.last_name,
    displayName: row.display_name,
    username: row.username,
    avatarUrl: row.avatar_url,
    dateOfBirth: row.date_of_birth,
    gender: row.gender,
    heightCm: row.height_cm === null ? null : Number(row.height_cm),
    startingWeightKg: row.starting_weight_kg === null ? null : Number(row.starting_weight_kg),
    timeZone: row.time_zone,
    primaryGoal: row.primary_goal,
    goalWeightKg: row.goal_weight_kg === null ? null : Number(row.goal_weight_kg),
    targetDailyCalories: row.target_daily_calories,
    activityLevel: row.activity_level,
    trainingExperience: row.training_experience,
    weeklyTrainingFrequency: row.weekly_training_frequency,
  };
}

export async function getOrCreateProfile(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<ProfileDTO> {
  const { data, error } = await supabase
    .from('profiles')
    .select(PROFILE_COLUMNS)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;
  if (data) return rowToDTO(data as ProfileRow);

  const { data: inserted, error: insertError } = await supabase
    .from('profiles')
    .insert({ user_id: userId })
    .select(PROFILE_COLUMNS)
    .single();

  if (insertError) {
    if (insertError.code === '23505') {
      const { data: existing, error: existingError } = await supabase
        .from('profiles')
        .select(PROFILE_COLUMNS)
        .eq('user_id', userId)
        .single();
      if (existingError) throw existingError;
      return rowToDTO(existing as ProfileRow);
    }
    throw insertError;
  }

  return rowToDTO(inserted as ProfileRow);
}
```

- [ ] **Step 2: Write `lib/profile/index.ts`**

```ts
export { getOrCreateProfile } from './server';
```

- [ ] **Step 3: Type-check**

Run: `pnpm type-check`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add lib/profile/server.ts lib/profile/index.ts
git commit -m "feat(profile): add getOrCreateProfile server helper"
```

---

## Task 6: `/api/profile` route (GET + PATCH) with tests

**Files:**
- Create: `app/api/profile/route.ts`
- Create: `app/api/profile/route.test.ts`

- [ ] **Step 1: Write the failing test**

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

import { GET, PATCH } from './route';
import { requireUser } from '@/lib/api/auth';

const mockRequireUser = vi.mocked(requireUser);
const USER_ID = 'user-aaa0-0000-0000-000000000000';

function makeRequest(method: 'GET' | 'PATCH', body?: unknown): Request {
  return new Request('http://localhost/api/profile', {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? null : JSON.stringify(body),
  });
}

const FULL_ROW = {
  first_name: 'Ada',
  last_name: null,
  display_name: null,
  username: null,
  avatar_url: null,
  date_of_birth: null,
  gender: null,
  height_cm: null,
  starting_weight_kg: null,
  time_zone: null,
  primary_goal: null,
  goal_weight_kg: null,
  target_daily_calories: null,
  activity_level: null,
  training_experience: null,
  weekly_training_frequency: null,
};

function makeSupabaseForGet(): any {
  return {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({ data: FULL_ROW, error: null }),
        }),
      }),
    }),
  };
}

function makeSupabaseForPatch(rowAfter: Record<string, unknown>): { client: any; upsert: ReturnType<typeof vi.fn> } {
  const upsert = vi.fn().mockReturnValue({
    select: vi.fn().mockReturnValue({
      single: vi.fn().mockResolvedValue({ data: rowAfter, error: null }),
    }),
  });
  return { client: { from: vi.fn().mockReturnValue({ upsert }) }, upsert };
}

describe('/api/profile', () => {
  beforeEach(() => vi.clearAllMocks());

  it('GET returns 401 when unauthenticated', async () => {
    const { ApiAuthError } = await import('@/lib/api/auth');
    mockRequireUser.mockRejectedValueOnce(new ApiAuthError());
    const res = await GET(makeRequest('GET'));
    expect(res.status).toBe(401);
  });

  it('GET returns 200 with camelCase DTO', async () => {
    mockRequireUser.mockResolvedValueOnce({ supabase: makeSupabaseForGet(), user: { id: USER_ID } as any });
    const res = await GET(makeRequest('GET'));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.firstName).toBe('Ada');
    expect(json.lastName).toBeNull();
  });

  it('PATCH returns 400 on empty body', async () => {
    mockRequireUser.mockResolvedValueOnce({ supabase: makeSupabaseForPatch(FULL_ROW).client, user: { id: USER_ID } as any });
    const res = await PATCH(makeRequest('PATCH', {}));
    expect(res.status).toBe(400);
  });

  it('PATCH 400 on invalid enum', async () => {
    mockRequireUser.mockResolvedValueOnce({ supabase: makeSupabaseForPatch(FULL_ROW).client, user: { id: USER_ID } as any });
    const res = await PATCH(makeRequest('PATCH', { primaryGoal: 'bulking' }));
    expect(res.status).toBe(400);
  });

  it('PATCH passes snake_case fields to upsert', async () => {
    const { client, upsert } = makeSupabaseForPatch({ ...FULL_ROW, first_name: 'Ada', primary_goal: 'strength' });
    mockRequireUser.mockResolvedValueOnce({ supabase: client, user: { id: USER_ID } as any });
    await PATCH(makeRequest('PATCH', { firstName: 'Ada', primaryGoal: 'strength' }));
    expect(upsert).toHaveBeenCalledWith(
      { user_id: USER_ID, first_name: 'Ada', primary_goal: 'strength' },
      { onConflict: 'user_id', ignoreDuplicates: false },
    );
  });

  it('PATCH returns 200 with canonical DTO', async () => {
    const { client } = makeSupabaseForPatch({ ...FULL_ROW, first_name: 'Ada' });
    mockRequireUser.mockResolvedValueOnce({ supabase: client, user: { id: USER_ID } as any });
    const res = await PATCH(makeRequest('PATCH', { firstName: 'Ada' }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.firstName).toBe('Ada');
  });
});
```

- [ ] **Step 2: Run the test, expect failure**

Run: `pnpm test -- app/api/profile/route.test.ts`
Expected: FAIL — `./route` module not found.

- [ ] **Step 3: Implement `app/api/profile/route.ts`**

```ts
import { requireUser } from '@/lib/api/auth';
import { handleApiError, jsonOk } from '@/lib/api/responses';
import { getOrCreateProfile } from '@/lib/profile';
import { profilePatchBodySchema, type ProfileDTO } from '@/lib/schemas/profile';

export const runtime = 'nodejs';

const PROFILE_COLUMNS =
  'first_name, last_name, display_name, username, avatar_url, date_of_birth, gender, ' +
  'height_cm, starting_weight_kg, time_zone, primary_goal, goal_weight_kg, ' +
  'target_daily_calories, activity_level, training_experience, weekly_training_frequency';

const CAMEL_TO_SNAKE: Record<string, string> = {
  firstName: 'first_name',
  lastName: 'last_name',
  displayName: 'display_name',
  username: 'username',
  avatarUrl: 'avatar_url',
  dateOfBirth: 'date_of_birth',
  gender: 'gender',
  heightCm: 'height_cm',
  startingWeightKg: 'starting_weight_kg',
  timeZone: 'time_zone',
  primaryGoal: 'primary_goal',
  goalWeightKg: 'goal_weight_kg',
  targetDailyCalories: 'target_daily_calories',
  activityLevel: 'activity_level',
  trainingExperience: 'training_experience',
  weeklyTrainingFrequency: 'weekly_training_frequency',
};

type ProfileRow = Record<string, unknown> & {
  first_name: string | null;
  last_name: string | null;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
  date_of_birth: string | null;
  gender: ProfileDTO['gender'];
  height_cm: number | null;
  starting_weight_kg: number | null;
  time_zone: string | null;
  primary_goal: ProfileDTO['primaryGoal'];
  goal_weight_kg: number | null;
  target_daily_calories: number | null;
  activity_level: ProfileDTO['activityLevel'];
  training_experience: ProfileDTO['trainingExperience'];
  weekly_training_frequency: number | null;
};

function rowToDTO(row: ProfileRow): ProfileDTO {
  return {
    firstName: row.first_name,
    lastName: row.last_name,
    displayName: row.display_name,
    username: row.username,
    avatarUrl: row.avatar_url,
    dateOfBirth: row.date_of_birth,
    gender: row.gender,
    heightCm: row.height_cm === null ? null : Number(row.height_cm),
    startingWeightKg: row.starting_weight_kg === null ? null : Number(row.starting_weight_kg),
    timeZone: row.time_zone,
    primaryGoal: row.primary_goal,
    goalWeightKg: row.goal_weight_kg === null ? null : Number(row.goal_weight_kg),
    targetDailyCalories: row.target_daily_calories,
    activityLevel: row.activity_level,
    trainingExperience: row.training_experience,
    weeklyTrainingFrequency: row.weekly_training_frequency,
  };
}

export async function GET(_request: Request): Promise<Response> {
  try {
    const { supabase, user } = await requireUser();
    const profile = await getOrCreateProfile(supabase, user.id);
    return jsonOk<ProfileDTO>(profile);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(request: Request): Promise<Response> {
  try {
    const { supabase, user } = await requireUser();
    const body = profilePatchBodySchema.parse(await request.json());

    const patchFields: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(body)) {
      const col = CAMEL_TO_SNAKE[k];
      if (col !== undefined) patchFields[col] = v;
    }

    const { data, error } = await supabase
      .from('profiles')
      .upsert(
        { user_id: user.id, ...patchFields },
        { onConflict: 'user_id', ignoreDuplicates: false },
      )
      .select(PROFILE_COLUMNS)
      .single();

    if (error) throw error;
    return jsonOk<ProfileDTO>(rowToDTO(data as ProfileRow));
  } catch (err) {
    return handleApiError(err);
  }
}
```

- [ ] **Step 4: Run the test, expect pass**

Run: `pnpm test -- app/api/profile/route.test.ts`
Expected: PASS, all 6 cases.

- [ ] **Step 5: Commit**

```bash
git add app/api/profile/route.ts app/api/profile/route.test.ts
git commit -m "feat(api): add GET/PATCH /api/profile with zod validation"
```

---

## Task 7: Account deletion API + tests

This calls Supabase admin to delete the user via the service-role key. RLS cascade then wipes all owned rows.

**Files:**
- Create: `app/api/account/delete/route.ts`
- Create: `app/api/account/delete/route.test.ts`

- [ ] **Step 1: Write the failing test**

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

const deleteUser = vi.fn();

vi.mock('@/lib/supabase/service-role', () => ({
  createSupabaseServiceRoleClient: () => ({
    auth: { admin: { deleteUser } },
  }),
}));

import { POST } from './route';
import { requireUser } from '@/lib/api/auth';

const mockRequireUser = vi.mocked(requireUser);
const USER_ID = 'user-aaa0-0000-0000-000000000000';

function makeRequest(body: unknown): Request {
  return new Request('http://localhost/api/account/delete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function makeSignOutSupabase(): any {
  return { auth: { signOut: vi.fn().mockResolvedValue({ error: null }) } };
}

describe('POST /api/account/delete', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    deleteUser.mockResolvedValue({ data: null, error: null });
  });

  it('returns 401 when unauthenticated', async () => {
    const { ApiAuthError } = await import('@/lib/api/auth');
    mockRequireUser.mockRejectedValueOnce(new ApiAuthError());
    const res = await POST(makeRequest({ confirm: 'DELETE' }));
    expect(res.status).toBe(401);
  });

  it('returns 400 when confirm string is missing or wrong', async () => {
    mockRequireUser.mockResolvedValue({ supabase: makeSignOutSupabase(), user: { id: USER_ID } as any });
    expect((await POST(makeRequest({}))).status).toBe(400);
    expect((await POST(makeRequest({ confirm: 'delete' }))).status).toBe(400);
    expect((await POST(makeRequest({ confirm: 'YES' }))).status).toBe(400);
    expect(deleteUser).not.toHaveBeenCalled();
  });

  it('calls admin.deleteUser with the caller user_id and returns 200', async () => {
    mockRequireUser.mockResolvedValueOnce({ supabase: makeSignOutSupabase(), user: { id: USER_ID } as any });
    const res = await POST(makeRequest({ confirm: 'DELETE' }));
    expect(res.status).toBe(200);
    expect(deleteUser).toHaveBeenCalledWith(USER_ID);
  });

  it('returns 500 when admin.deleteUser errors', async () => {
    deleteUser.mockResolvedValueOnce({ data: null, error: { message: 'boom' } });
    mockRequireUser.mockResolvedValueOnce({ supabase: makeSignOutSupabase(), user: { id: USER_ID } as any });
    const res = await POST(makeRequest({ confirm: 'DELETE' }));
    expect(res.status).toBe(500);
  });
});
```

- [ ] **Step 2: Run the test, expect failure**

Run: `pnpm test -- app/api/account/delete/route.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Verify `createSupabaseServiceRoleClient` exists**

Run: `grep -n "createSupabaseServiceRoleClient\|export" lib/supabase/service-role.ts`
Expected: a `createSupabaseServiceRoleClient` (or similarly named) export. If the export name differs, adjust the mock + import path in the test and implementation to match.

- [ ] **Step 4: Implement `app/api/account/delete/route.ts`**

```ts
import { z } from 'zod';

import { requireUser } from '@/lib/api/auth';
import { handleApiError, jsonError, jsonOk } from '@/lib/api/responses';
import { createSupabaseServiceRoleClient } from '@/lib/supabase/service-role';

export const runtime = 'nodejs';

const bodySchema = z.object({
  confirm: z.literal('DELETE'),
});

export async function POST(request: Request): Promise<Response> {
  try {
    const { supabase, user } = await requireUser();

    const parseResult = bodySchema.safeParse(await request.json().catch(() => ({})));
    if (!parseResult.success) {
      return jsonError(400, 'VALIDATION_ERROR', 'Confirmation string must be "DELETE"');
    }

    const admin = createSupabaseServiceRoleClient();
    const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
    if (deleteError) {
      console.error('[POST /api/account/delete] admin.deleteUser failed:', deleteError);
      return jsonError(500, 'INTERNAL_SERVER_ERROR', 'Failed to delete account');
    }

    await supabase.auth.signOut();

    return jsonOk<{ ok: true }>({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
```

- [ ] **Step 5: Run the test, expect pass**

Run: `pnpm test -- app/api/account/delete/route.test.ts`
Expected: PASS, all 4 cases.

- [ ] **Step 6: Commit**

```bash
git add app/api/account/delete/route.ts app/api/account/delete/route.test.ts
git commit -m "feat(api): add POST /api/account/delete with DELETE confirmation"
```

---

## Task 8: Profile primitive — `Segmented`

**Files:**
- Create: `features/profile/components/ui/Segmented.tsx`

- [ ] **Step 1: Implement `Segmented.tsx`**

```tsx
'use client';

import * as React from 'react';

import { cn } from '@/lib/utils';

interface SegmentedOption<T extends string> {
  value: T;
  label: React.ReactNode;
}

interface SegmentedProps<T extends string> {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (next: T) => void;
  ariaLabel?: string;
  className?: string;
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  className,
}: SegmentedProps<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn(
        'inline-flex items-center rounded-md border border-input bg-card p-0.5',
        className,
      )}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-pressed={active}
            onClick={() => onChange(opt.value)}
            className={cn(
              'inline-flex h-8 min-w-[2.5rem] items-center justify-center rounded-[0.4rem] px-3 text-sm font-medium transition-colors',
              active
                ? 'bg-secondary text-foreground'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `pnpm type-check`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add features/profile/components/ui/Segmented.tsx
git commit -m "feat(profile-ui): add Segmented control"
```

---

## Task 9: Profile primitives — `Pill`, `IconChip`, `Field`

**Files:**
- Create: `features/profile/components/ui/Pill.tsx`
- Create: `features/profile/components/ui/IconChip.tsx`
- Create: `features/profile/components/ui/Field.tsx`

- [ ] **Step 1: Implement `Pill.tsx`**

```tsx
import * as React from 'react';

import { cn } from '@/lib/utils';

type Tone = 'neutral' | 'brand' | 'success' | 'danger';

interface PillProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
}

const TONE_CLASS: Record<Tone, string> = {
  neutral: 'border-border bg-secondary text-foreground',
  brand: 'border-brand/30 bg-brand/10 text-brand',
  success: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400',
  danger: 'border-destructive/30 bg-destructive/10 text-destructive',
};

export function Pill({ tone = 'neutral', className, ...rest }: PillProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium',
        TONE_CLASS[tone],
        className,
      )}
      {...rest}
    />
  );
}
```

- [ ] **Step 2: Implement `IconChip.tsx`**

```tsx
import * as React from 'react';
import type { LucideIcon } from 'lucide-react';

import { cn } from '@/lib/utils';

interface IconChipProps {
  icon: LucideIcon;
  active?: boolean;
  className?: string;
  ariaHidden?: boolean;
}

export function IconChip({ icon: Icon, active = false, className, ariaHidden = true }: IconChipProps) {
  return (
    <span
      aria-hidden={ariaHidden}
      className={cn(
        'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border transition-colors',
        active
          ? 'border-brand/30 bg-brand/10 text-brand'
          : 'border-border bg-secondary text-muted-foreground',
        className,
      )}
    >
      <Icon className="h-4 w-4" />
    </span>
  );
}
```

- [ ] **Step 3: Implement `Field.tsx`**

```tsx
import * as React from 'react';

import { cn } from '@/lib/utils';

interface FieldProps {
  label: string;
  htmlFor?: string;
  hint?: React.ReactNode;
  error?: string;
  className?: string;
  children: React.ReactNode;
}

export function Field({ label, htmlFor, hint, error, className, children }: FieldProps) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <label htmlFor={htmlFor} className="text-sm font-medium leading-none">
        {label}
      </label>
      {children}
      {error ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 4: Type-check**

Run: `pnpm type-check`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add features/profile/components/ui/Pill.tsx features/profile/components/ui/IconChip.tsx features/profile/components/ui/Field.tsx
git commit -m "feat(profile-ui): add Pill, IconChip, and Field primitives"
```

---

## Task 10: `SectionRow` primitive

**Files:**
- Create: `features/profile/components/ui/SectionRow.tsx`

- [ ] **Step 1: Implement `SectionRow.tsx`**

```tsx
'use client';

import Link from 'next/link';
import { ChevronRight, type LucideIcon } from 'lucide-react';
import * as React from 'react';

import { cn } from '@/lib/utils';

import { IconChip } from './IconChip';

interface SectionRowProps {
  icon: LucideIcon;
  label: string;
  sublabel?: string;
  href?: string;
  onSelect?: () => void;
  active?: boolean;
  trailing?: React.ReactNode;
  className?: string;
}

export function SectionRow({
  icon,
  label,
  sublabel,
  href,
  onSelect,
  active = false,
  trailing,
  className,
}: SectionRowProps) {
  const content = (
    <>
      <IconChip icon={icon} active={active} />
      <span className="flex min-w-0 flex-1 flex-col text-left">
        <span className="truncate text-sm font-medium text-foreground">{label}</span>
        {sublabel ? <span className="truncate text-xs text-muted-foreground">{sublabel}</span> : null}
      </span>
      {trailing ?? <ChevronRight className={cn('h-4 w-4 shrink-0', active ? 'text-brand' : 'text-muted-foreground')} />}
    </>
  );

  const classes = cn(
    'flex w-full min-h-[3.25rem] items-center gap-3 rounded-lg border border-transparent px-3 py-2 transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
    active && 'bg-accent',
    className,
  );

  if (href) {
    return (
      <Link href={href} className={classes} aria-current={active ? 'page' : undefined}>
        {content}
      </Link>
    );
  }

  return (
    <button type="button" onClick={onSelect} className={classes}>
      {content}
    </button>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `pnpm type-check`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add features/profile/components/ui/SectionRow.tsx
git commit -m "feat(profile-ui): add SectionRow primitive with active state"
```

---

## Task 11: `ProfileHeader` component (read-only for v1)

**Files:**
- Create: `features/profile/components/ProfileHeader.tsx`

The avatar pencil badge is rendered but disabled (upload flow is a follow-up plan). Display name comes from `displayName || firstName + lastName || email-prefix`.

- [ ] **Step 1: Implement `ProfileHeader.tsx`**

```tsx
'use client';

import { Pencil } from 'lucide-react';
import * as React from 'react';

import type { ProfileDTO } from '@/lib/schemas/profile';

interface ProfileHeaderProps {
  profile: ProfileDTO;
  email: string | null;
}

function initials(profile: ProfileDTO, email: string | null): string {
  const first = profile.firstName?.trim()?.[0];
  const last = profile.lastName?.trim()?.[0];
  if (first && last) return `${first}${last}`.toUpperCase();
  if (first) return first.toUpperCase();
  const base = profile.displayName ?? profile.username ?? email ?? '?';
  return base.trim()[0]?.toUpperCase() ?? '?';
}

function displayName(profile: ProfileDTO, email: string | null): string {
  if (profile.displayName?.trim()) return profile.displayName;
  const combined = [profile.firstName, profile.lastName].filter(Boolean).join(' ').trim();
  if (combined) return combined;
  if (email) return email.split('@')[0];
  return 'Your profile';
}

export function ProfileHeader({ profile, email }: ProfileHeaderProps) {
  const handle = profile.username ? `@${profile.username}` : null;
  const subtitle = [handle, email].filter(Boolean).join(' · ');

  return (
    <div className="flex items-center gap-4 rounded-xl border border-border bg-card p-6">
      <div className="relative">
        {profile.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={profile.avatarUrl}
            alt=""
            className="h-14 w-14 rounded-full object-cover"
          />
        ) : (
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-secondary text-base font-semibold text-foreground">
            {initials(profile, email)}
          </div>
        )}
        <button
          type="button"
          disabled
          aria-label="Change profile photo (coming soon)"
          className="absolute -bottom-1 -right-1 inline-flex h-6 w-6 items-center justify-center rounded-full border-2 border-background bg-secondary text-muted-foreground opacity-60 hover:bg-brand hover:text-brand-foreground disabled:cursor-not-allowed"
        >
          <Pencil className="h-3 w-3" />
        </button>
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[18px] font-semibold leading-tight">{displayName(profile, email)}</p>
        {subtitle ? (
          <p className="truncate text-sm text-muted-foreground">{subtitle}</p>
        ) : null}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `pnpm type-check`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add features/profile/components/ProfileHeader.tsx
git commit -m "feat(profile): add ProfileHeader with initials fallback"
```

---

## Task 12: `SectionList` — six rows + sign-out

**Files:**
- Create: `features/profile/components/SectionList.tsx`

- [ ] **Step 1: Implement `SectionList.tsx`**

```tsx
'use client';

import { CreditCard, Ruler, Sliders, Target, UserRound } from 'lucide-react';
import * as React from 'react';

import { SignOutButton } from '@/app/(app)/profile/sign-out-button';

import { SectionRow } from './ui/SectionRow';

interface SectionListProps {
  activeSection?: SectionKey;
  className?: string;
}

export type SectionKey = 'personal' | 'fitness' | 'body' | 'preferences' | 'subscription';

const SECTIONS: Array<{
  key: SectionKey;
  href: string;
  label: string;
  sublabel: string;
  icon: typeof UserRound;
}> = [
  { key: 'personal',     href: '/profile/personal',     label: 'Personal info',     sublabel: 'Name, age, height & basics',     icon: UserRound },
  { key: 'fitness',      href: '/profile/fitness',      label: 'Fitness profile',   sublabel: 'Goals, activity & experience',   icon: Target },
  { key: 'body',         href: '/profile/body-metrics', label: 'Body metrics',      sublabel: 'BMI, weight & measurements',     icon: Ruler },
  { key: 'preferences',  href: '/profile/preferences',  label: 'Preferences',       sublabel: 'Units, rest timer & defaults',   icon: Sliders },
  { key: 'subscription', href: '/profile/subscription', label: 'Subscription',      sublabel: 'Plan & usage',                    icon: CreditCard },
];

export function SectionList({ activeSection, className }: SectionListProps) {
  return (
    <nav className={className} aria-label="Profile sections">
      <ul className="flex flex-col gap-1">
        {SECTIONS.map((s) => (
          <li key={s.key}>
            <SectionRow
              icon={s.icon}
              label={s.label}
              sublabel={s.sublabel}
              href={s.href}
              active={s.key === activeSection}
            />
          </li>
        ))}
      </ul>
      <div className="mt-6">
        <SignOutButton />
      </div>
    </nav>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `pnpm type-check`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add features/profile/components/SectionList.tsx
git commit -m "feat(profile): add SectionList with six rows and sign-out"
```

---

## Task 13: Change-password row + hook

**Files:**
- Create: `features/profile/hooks/useChangePassword.ts`
- Create: `features/profile/components/ChangePasswordRow.tsx`

Fires `supabase.auth.resetPasswordForEmail` from the client; success toast.

- [ ] **Step 1: Implement `useChangePassword.ts`**

```ts
'use client';

import * as React from 'react';
import { toast } from 'sonner';

import { createSupabaseBrowserClient } from '@/lib/supabase/browser';

export function useChangePassword() {
  const [isSending, setIsSending] = React.useState(false);

  async function send(email: string | null) {
    if (!email) {
      toast.error('No email on file');
      return;
    }
    setIsSending(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const redirectTo =
        typeof window === 'undefined' ? undefined : `${window.location.origin}/auth/callback`;
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
      if (error) {
        toast.error('Could not send reset link');
        return;
      }
      toast.success('Password reset link sent to your email.');
    } finally {
      setIsSending(false);
    }
  }

  return { send, isSending };
}
```

- [ ] **Step 2: Confirm `createSupabaseBrowserClient` export**

Run: `grep -n "export" lib/supabase/browser.ts`
Expected: an export whose name matches the import above. If different, fix the import.

- [ ] **Step 3: Implement `ChangePasswordRow.tsx`**

```tsx
'use client';

import { Lock, Mail } from 'lucide-react';

import { SectionRow } from './ui/SectionRow';
import { useChangePassword } from '../hooks/useChangePassword';

interface ChangePasswordRowProps {
  email: string | null;
}

export function ChangePasswordRow({ email }: ChangePasswordRowProps) {
  const { send, isSending } = useChangePassword();
  return (
    <div className="rounded-xl border border-border bg-card">
      <button
        type="button"
        onClick={() => void send(email)}
        disabled={isSending}
        className="flex w-full min-h-[3.25rem] items-center gap-3 rounded-xl px-4 py-3 transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-60"
      >
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-secondary text-muted-foreground">
          <Lock className="h-4 w-4" />
        </span>
        <span className="flex min-w-0 flex-1 flex-col text-left">
          <span className="truncate text-sm font-medium">Change password</span>
          <span className="truncate text-xs text-muted-foreground">
            {isSending ? 'Sending reset link…' : 'We will email a secure reset link'}
          </span>
        </span>
      </button>
      <div className="flex items-center gap-3 border-t border-border px-4 py-3">
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-secondary text-muted-foreground">
          <Mail className="h-4 w-4" />
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-sm font-medium">{email ?? '—'}</span>
          <span className="truncate text-xs text-muted-foreground">Verified</span>
        </span>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Type-check**

Run: `pnpm type-check`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add features/profile/hooks/useChangePassword.ts features/profile/components/ChangePasswordRow.tsx
git commit -m "feat(profile): add change-password row backed by reset-email flow"
```

---

## Task 14: Delete-account dialog + hook

**Files:**
- Create: `features/profile/hooks/useDeleteAccount.ts`
- Create: `features/profile/components/DeleteAccountDialog.tsx`

- [ ] **Step 1: Implement `useDeleteAccount.ts`**

```ts
'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { useActiveWorkoutStore } from '@/features/workout/store/useActiveWorkoutStore';
import { clearPendingDuplicate } from '@/features/plan/lib/pendingDuplicate';

export function useDeleteAccount() {
  const [isDeleting, setIsDeleting] = React.useState(false);
  const router = useRouter();
  const queryClient = useQueryClient();

  async function deleteAccount(): Promise<void> {
    setIsDeleting(true);
    try {
      const res = await fetch('/api/account/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm: 'DELETE' }),
      });
      if (!res.ok) {
        toast.error('Failed to delete account. Please try again.');
        return;
      }

      // Mirror the sign-out cleanup contract.
      useActiveWorkoutStore.getState().resetStore();
      useActiveWorkoutStore.persist.clearStorage();
      queryClient.clear();
      clearPendingDuplicate();
      toast.dismiss('persistence-degraded');

      router.replace('/auth');
    } finally {
      setIsDeleting(false);
    }
  }

  return { deleteAccount, isDeleting };
}
```

- [ ] **Step 2: Implement `DeleteAccountDialog.tsx`**

```tsx
'use client';

import { Trash2 } from 'lucide-react';
import * as React from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

import { useDeleteAccount } from '../hooks/useDeleteAccount';

export function DeleteAccountDialog() {
  const { deleteAccount, isDeleting } = useDeleteAccount();
  const [open, setOpen] = React.useState(false);
  const [confirm, setConfirm] = React.useState('');

  const canConfirm = confirm === 'DELETE' && !isDeleting;

  React.useEffect(() => {
    if (!open) setConfirm('');
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="flex w-full min-h-[3.25rem] items-center gap-3 rounded-xl border border-destructive/25 bg-card px-4 py-3 text-left transition-colors hover:bg-destructive/10 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-destructive"
        >
          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-destructive/30 bg-destructive/10 text-destructive">
            <Trash2 className="h-4 w-4" />
          </span>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-sm font-medium text-destructive">Delete account</span>
            <span className="truncate text-xs text-muted-foreground">This action cannot be undone</span>
          </span>
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete your account?</DialogTitle>
          <DialogDescription>
            This permanently deletes your account, workouts, plans, and all related data. This cannot be undone.
            Type <span className="font-mono font-semibold text-foreground">DELETE</span> to confirm.
          </DialogDescription>
        </DialogHeader>
        <Input
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="Type DELETE"
          autoComplete="off"
          aria-label="Type DELETE to confirm"
        />
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={isDeleting}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={!canConfirm}
            onClick={() => void deleteAccount()}
          >
            {isDeleting ? 'Deleting…' : 'Delete account'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 3: Type-check**

Run: `pnpm type-check`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add features/profile/hooks/useDeleteAccount.ts features/profile/components/DeleteAccountDialog.tsx
git commit -m "feat(profile): add delete-account dialog with DELETE confirmation"
```

---

## Task 15: `AccountSection` — wraps password row + delete row

**Files:**
- Create: `features/profile/components/AccountSection.tsx`

- [ ] **Step 1: Implement `AccountSection.tsx`**

```tsx
import { ChangePasswordRow } from './ChangePasswordRow';
import { DeleteAccountDialog } from './DeleteAccountDialog';

interface AccountSectionProps {
  email: string | null;
}

export function AccountSection({ email }: AccountSectionProps) {
  return (
    <section aria-labelledby="profile-account-heading" className="space-y-4">
      <h2
        id="profile-account-heading"
        className="text-xs font-semibold uppercase tracking-widest text-muted-foreground"
      >
        Account
      </h2>
      <ChangePasswordRow email={email} />
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-widest text-destructive">
          Danger zone
        </p>
        <DeleteAccountDialog />
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
git add features/profile/components/AccountSection.tsx
git commit -m "feat(profile): add AccountSection grouping password + danger zone"
```

---

## Task 16: Profile layout — master/detail desktop + mobile push wrapper

**Files:**
- Create: `app/(app)/profile/layout.tsx`

On `lg`+, layout renders a 300px sticky section list on the left and the route segment in a right pane. Below `lg`, the layout renders the section list **only when the route is exactly `/profile`** (handled by the page) and otherwise lets the segment fill the screen — the visual "push" is handled by routing + the parallax animation in Task 19.

For Task 16 we ship the desktop split + the mobile single-pane (no animation yet). Animation lands in Task 19.

- [ ] **Step 1: Implement `app/(app)/profile/layout.tsx`**

```tsx
import type { Metadata } from 'next';
import * as React from 'react';

import { PageContainer } from '@/components/page-container';
import { ProfileHeader } from '@/features/profile/components/ProfileHeader';
import { SectionList } from '@/features/profile/components/SectionList';
import { getOrCreateProfile } from '@/lib/profile';
import { createSupabaseServerClient } from '@/lib/supabase/server-exports';

export const metadata: Metadata = {
  title: 'Profile — LimenFit',
};

export default async function ProfileLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const profile = user ? await getOrCreateProfile(supabase, user.id) : null;
  const email = user?.email ?? null;

  return (
    <PageContainer title="Profile" className="lg:max-w-5xl">
      <div className="mb-6">
        {profile ? <ProfileHeader profile={profile} email={email} /> : null}
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[300px_minmax(0,1fr)]">
        <div className="hidden lg:block lg:sticky lg:top-10 lg:self-start">
          <SectionList />
        </div>
        <div className="min-w-0">{children}</div>
      </div>
    </PageContainer>
  );
}
```

Note: the active-section highlight is driven by the route. We'll add it in Task 17 by reading `usePathname` inside a small client wrapper.

- [ ] **Step 2: Type-check**

Run: `pnpm type-check`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add app/\(app\)/profile/layout.tsx
git commit -m "feat(profile): add layout with sticky section list on desktop"
```

---

## Task 17: Drive SectionList active row from current route

**Files:**
- Modify: `features/profile/components/SectionList.tsx`

- [ ] **Step 1: Edit `SectionList.tsx` to read `usePathname` when no explicit `activeSection` is passed**

Replace the `SectionList` function body to derive `activeSection` from `usePathname()` when `activeSection` prop is omitted:

```tsx
'use client';

import { CreditCard, Ruler, Sliders, Target, UserRound } from 'lucide-react';
import { usePathname } from 'next/navigation';
import * as React from 'react';

import { SignOutButton } from '@/app/(app)/profile/sign-out-button';

import { SectionRow } from './ui/SectionRow';

export type SectionKey = 'personal' | 'fitness' | 'body' | 'preferences' | 'subscription';

interface SectionListProps {
  activeSection?: SectionKey;
  className?: string;
}

const SECTIONS: Array<{
  key: SectionKey;
  href: string;
  label: string;
  sublabel: string;
  icon: typeof UserRound;
}> = [
  { key: 'personal',     href: '/profile/personal',     label: 'Personal info',     sublabel: 'Name, age, height & basics',     icon: UserRound },
  { key: 'fitness',      href: '/profile/fitness',      label: 'Fitness profile',   sublabel: 'Goals, activity & experience',   icon: Target },
  { key: 'body',         href: '/profile/body-metrics', label: 'Body metrics',      sublabel: 'BMI, weight & measurements',     icon: Ruler },
  { key: 'preferences',  href: '/profile/preferences',  label: 'Preferences',       sublabel: 'Units, rest timer & defaults',   icon: Sliders },
  { key: 'subscription', href: '/profile/subscription', label: 'Subscription',      sublabel: 'Plan & usage',                    icon: CreditCard },
];

function pathToKey(pathname: string | null): SectionKey | undefined {
  if (!pathname) return undefined;
  return SECTIONS.find((s) => pathname.startsWith(s.href))?.key;
}

export function SectionList({ activeSection, className }: SectionListProps) {
  const pathname = usePathname();
  const resolved = activeSection ?? pathToKey(pathname);

  return (
    <nav className={className} aria-label="Profile sections">
      <ul className="flex flex-col gap-1">
        {SECTIONS.map((s) => (
          <li key={s.key}>
            <SectionRow
              icon={s.icon}
              label={s.label}
              sublabel={s.sublabel}
              href={s.href}
              active={s.key === resolved}
            />
          </li>
        ))}
      </ul>
      <div className="mt-6">
        <SignOutButton />
      </div>
    </nav>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `pnpm type-check`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add features/profile/components/SectionList.tsx
git commit -m "feat(profile): highlight section row matching current route"
```

---

## Task 18: Rewrite `/profile` landing — header lives in layout; page renders SectionList (mobile) + AccountSection

**Files:**
- Modify: `app/(app)/profile/page.tsx`
- Modify: `features/profile/components/ProfileView.tsx`
- Modify: `features/profile/index.ts`

- [ ] **Step 1: Rewrite `features/profile/components/ProfileView.tsx`**

```tsx
'use client';

import { AccountSection } from './AccountSection';
import { SectionList } from './SectionList';

interface ProfileViewProps {
  email: string | null;
}

export function ProfileView({ email }: ProfileViewProps) {
  return (
    <div className="space-y-8">
      <div className="lg:hidden">
        <SectionList />
      </div>
      <AccountSection email={email} />
    </div>
  );
}
```

The desktop case shows the section list in the layout's left rail; this page-level `SectionList` is mobile-only.

- [ ] **Step 2: Update `app/(app)/profile/page.tsx` to use the new layout (drop the local `PageContainer` since layout owns it)**

```tsx
import { ProfileView } from '@/features/profile';
import { createSupabaseServerClient } from '@/lib/supabase/server-exports';

export default async function ProfilePage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return <ProfileView email={user?.email ?? null} />;
}
```

- [ ] **Step 3: Update `features/profile/index.ts` exports**

```ts
export { ProfileView } from './components/ProfileView';
export { AccountInfo } from './components/AccountInfo';
export { SettingsForm } from './components/SettingsForm';
export { ProfileHeader } from './components/ProfileHeader';
export { SectionList } from './components/SectionList';
export { AccountSection } from './components/AccountSection';
export { useUpdateSettingsMutation } from './hooks/useUpdateSettingsMutation';
```

- [ ] **Step 4: Type-check + lint**

Run: `pnpm type-check && pnpm lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/\(app\)/profile/page.tsx features/profile/components/ProfileView.tsx features/profile/index.ts
git commit -m "feat(profile): landing renders SectionList (mobile) + AccountSection"
```

---

## Task 19: Sub-page stubs

Each stub renders a "Coming soon" placeholder so navigation works end-to-end. Real content lands in follow-up plans.

**Files:**
- Create: `app/(app)/profile/personal/page.tsx`
- Create: `app/(app)/profile/fitness/page.tsx`
- Create: `app/(app)/profile/body-metrics/page.tsx`
- Create: `app/(app)/profile/preferences/page.tsx`
- Create: `app/(app)/profile/subscription/page.tsx`

- [ ] **Step 1: Build a tiny shared stub component**

Create `features/profile/components/SectionStub.tsx`:

```tsx
import * as React from 'react';

interface SectionStubProps {
  title: string;
  description: string;
}

export function SectionStub({ title, description }: SectionStubProps) {
  return (
    <section className="rounded-xl border border-dashed border-border bg-card p-8 text-center">
      <h1 className="text-lg font-semibold">{title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{description}</p>
      <p className="mt-4 text-xs text-muted-foreground">Coming soon</p>
    </section>
  );
}
```

- [ ] **Step 2: Add `SectionStub` to the barrel**

In `features/profile/index.ts`, append:

```ts
export { SectionStub } from './components/SectionStub';
```

- [ ] **Step 3: Create the five stub pages**

Each follows the same shape — example for `app/(app)/profile/personal/page.tsx`:

```tsx
import { SectionStub } from '@/features/profile';

export default function PersonalPage() {
  return <SectionStub title="Personal info" description="Name, age, height and basics." />;
}
```

Repeat with appropriate copy:
- `fitness/page.tsx` — title `"Fitness profile"`, description `"Goals, activity and experience."`
- `body-metrics/page.tsx` — title `"Body metrics"`, description `"BMI, weight log and measurements."`
- `preferences/page.tsx` — title `"Preferences"`, description `"Units, rest timer and defaults."`
- `subscription/page.tsx` — title `"Subscription"`, description `"Plan and usage."`

- [ ] **Step 4: Type-check**

Run: `pnpm type-check`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add features/profile/components/SectionStub.tsx features/profile/index.ts \
  app/\(app\)/profile/personal app/\(app\)/profile/fitness \
  app/\(app\)/profile/body-metrics app/\(app\)/profile/preferences \
  app/\(app\)/profile/subscription
git commit -m "feat(profile): add sub-page stubs for personal/fitness/body-metrics/preferences/subscription"
```

---

## Task 20: Mobile iOS-style slide transition

For v1, we use a CSS-only slide via `template.tsx` (Next.js animates route changes by remounting the template). Honors `prefers-reduced-motion`.

**Files:**
- Create: `app/(app)/profile/template.tsx`

- [ ] **Step 1: Implement `app/(app)/profile/template.tsx`**

```tsx
'use client';

import { usePathname } from 'next/navigation';
import * as React from 'react';

import { cn } from '@/lib/utils';

export default function ProfileTemplate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLanding = pathname === '/profile';

  return (
    <div
      className={cn(
        'lg:contents motion-safe:transition-transform motion-safe:duration-300 motion-safe:ease-out',
        // Mobile only: slide content in from the right on sub-pages.
        // Landing uses translate-x-0 too — there is no animation to play on /profile itself.
        !isLanding && 'motion-safe:animate-[profile-push_300ms_ease-out]',
      )}
    >
      {children}
    </div>
  );
}
```

- [ ] **Step 2: Add the keyframes to globals**

Append to `styles/globals.css` (locate the existing `@layer base` or the bottom of the file):

```css
@keyframes profile-push {
  from { transform: translateX(100%); opacity: 0.4; }
  to   { transform: translateX(0);    opacity: 1; }
}
```

- [ ] **Step 3: Verify in dev**

Run: `pnpm dev` and open `http://localhost:3000/profile` after signing in. Tap each section row on a narrow viewport (devtools → 390×844). Expected: each sub-page slides in from the right on mobile, no animation on desktop, no flash. Browser back ↩ returns to the list. Turn on macOS Reduced Motion (System Settings → Accessibility → Display → Reduce Motion) and verify the slide is suppressed.

- [ ] **Step 4: Commit**

```bash
git add app/\(app\)/profile/template.tsx styles/globals.css
git commit -m "feat(profile): add iOS-style slide transition on sub-page push"
```

---

## Task 21: End-to-end smoke + cleanup

- [ ] **Step 1: Run the full test suite**

Run: `pnpm test`
Expected: ALL tests pass.

- [ ] **Step 2: Run type-check + lint + format check**

Run: `pnpm type-check && pnpm lint && pnpm format:check`
Expected: ALL pass.

- [ ] **Step 3: Manual smoke checklist (with `pnpm dev`)**

- [ ] Sign in → `/profile` shows the new ProfileHeader with initials fallback.
- [ ] Desktop (≥1024px): section list is a sticky left rail. Hover and active-row states work. The right pane shows the Account section on `/profile`.
- [ ] Click each section row → URL updates to `/profile/<section>`, page shows the stub, section row is highlighted.
- [ ] Mobile (<1024px): landing shows section list above the Account section. Tapping a row slides the sub-page in from the right.
- [ ] Browser back returns to the landing.
- [ ] Click "Change password" → toast: "Password reset link sent to your email."
- [ ] Click "Delete account" → dialog opens, button stays disabled until `DELETE` is typed. Cancel dismisses. (Do not actually delete unless you are testing with a throwaway account.)
- [ ] Sign Out works as before.

- [ ] **Step 4: Commit anything fixed during smoke (if any)**

```bash
# Only if there are changes
git add -A
git commit -m "fix(profile): smoke-test follow-ups"
```

---

## Self-review

### Spec coverage

| Spec section | Covered by |
|---|---|
| §2 Tokens — brand color | Task 1 |
| §3 Routing & file structure (per-route layout) | Tasks 16, 17, 19 |
| §4 Shared components — Segmented, Pill, Field, Row | Tasks 8, 9, 10 (full forms ship in follow-ups) |
| §5 Profile header | Task 11 (avatar upload deferred) |
| §6.1–6.5 Section sub-pages | Stubbed in Task 19; full builds in follow-up plans |
| §6.6 Account inline (Change password + Delete account) | Tasks 13, 14, 15 |
| Sign Out (bottom of section list) | Task 12 (reuses existing `sign-out-button.tsx`) |
| §7 Desktop master/detail | Task 16 |
| §7 Mobile iOS push | Task 20 |
| §7 Confirmations — delete typed-`DELETE` modal | Task 14 |
| §7 Confirmations — password reset toast | Task 13 |
| §8 Reduced-motion | Task 20 (`motion-safe:` utilities) |
| §10 Canonical kg/cm | Tasks 2, 4 (storage), and stated in plan header |
| §10 Per-route vs single-page | Per-route, Tasks 16/19 |
| §10 Primary CTA color | Near-white (default `Button` variant retained) |

Out-of-scope (follow-up plans):
- Personal, Fitness, Preferences forms (data layer is ready)
- Body Metrics (BMI calc + weight chart + measurements + photos placeholder)
- Subscription stub UI
- Avatar upload to Supabase Storage
- Bodyweight + measurements tables (separate migration when Body Metrics plan ships)

### Type consistency
- `ProfileDTO` properties in Task 4 are used identically in Tasks 5, 6, 11, 14.
- `SectionKey` values in Task 12 match the `pathToKey` matching in Task 17 (`personal | fitness | body | preferences | subscription`).
- API DTO field names match across `useChangePassword` / `useDeleteAccount` (no DTO needed) and `/api/account/delete` body `{ confirm: 'DELETE' }`.

### Placeholders
None — every step shows the code or command.
