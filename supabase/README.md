# supabase

Database migrations and seed data.

> **Production migrations** are applied automatically via GitHub Actions — see the root `README.md` under `## Migration workflow (remote)` for secrets, the automated trigger, and the manual escape hatch. This file covers local development only.

- `migrations/` — all Phase 1 schema migrations are applied. Run `pnpm db:reset` to replay them against the local DB.
- `seed.sql` — pre-populated with the global strength exercise library (bodyweight, barbell, dumbbell, cable, and machine exercises; no cardio rows). Custom exercises are created by users at runtime.
- `functions/` is reserved for Supabase Edge Functions and is not used in Phase 1.

---

## Prerequisites

- **Docker Desktop** must be running before executing any `db:*` commands.
- `pnpm install` must have been run at the repo root.

---

## Local development

The five `db:*` scripts are wired to the Supabase CLI:

| Script | Description |
| --- | --- |
| `pnpm db:start` | Boot the local Postgres + Auth + Studio + Storage stack |
| `pnpm db:stop` | Stop the local stack and release ports |
| `pnpm db:reset` | Re-apply all migrations and seed data against the local DB |
| `pnpm db:push` | Apply pending local migrations to the linked remote project |
| `pnpm db:diff` | Generate a new migration file from local schema drift |

---

## No-op migration smoke test

To verify the end-to-end migration workflow without committing real schema, run the following against your local Supabase instance:

```bash
pnpm exec supabase migration new noop_check
pnpm db:reset
```

**Delete the generated noop file** (`supabase/migrations/*_noop_check.sql`) before committing — it is intentionally transient and must not land in the repo.

---

## Phase 1 schema verification

Run these checks after `pnpm db:reset` completes with no errors.

### 1. Clean reset

```bash
pnpm db:reset
# Expected: all 11 migrations apply with no errors
```

### 2. One-active-draft constraint

```sql
-- Insert a user first, then:
INSERT INTO workouts (user_id, status) VALUES ('<uid>', 'in_progress');
INSERT INTO workouts (user_id, status) VALUES ('<uid>', 'in_progress');
-- Expected: ERROR: duplicate key value violates unique constraint
--           "workouts_one_active_draft_per_user"
```

### 3. Constraint allows restart after completion

```sql
UPDATE workouts SET status = 'completed' WHERE user_id = '<uid>' AND status = 'in_progress';
INSERT INTO workouts (user_id, status) VALUES ('<uid>', 'in_progress');
-- Expected: INSERT succeeds — partial index only covers status = 'in_progress'
```

### 4. Anon-key visibility

```sql
-- With anon JWT (auth.uid() IS NULL):
SELECT id FROM plans;
-- Expected: only rows where is_public = true

SELECT id FROM exercises;
-- Expected: only rows where user_id IS NULL (global library)
```

### 5. Cross-user isolation

```sql
-- Authenticated as user A, reading user B's workouts:
SELECT * FROM workouts;
-- Expected: 0 rows (RLS filters to auth.uid() = user_id)
```

---

## pg_cron jobs

Both jobs are registered by `migrations/20260421150316_cron_jobs.sql` and run as the `postgres` role, which bypasses RLS by design — this is the intended privileged-server behaviour for background maintenance tasks.

Cascade behaviour is correct by schema: deleting a `workouts` row cascades to `workout_exercises` and `sets`.

### Registered jobs

| Job name | Schedule (UTC) | Purpose |
|---|---|---|
| `limenfit_expire_inprogress_workouts` | `0 * * * *` (every hour) | Transition abandoned `in_progress` drafts to `expired` after 24 h of inactivity |
| `limenfit_delete_expired_workouts` | `0 3 * * *` (daily 03:00) | Hard-delete `expired` workouts that have passed the 7-day grace period |

### Job bodies

```sql
-- Job 1: expire abandoned drafts
UPDATE public.workouts
SET status = 'expired', expired_at = NOW()
WHERE status = 'in_progress'
  AND last_activity_at < NOW() - INTERVAL '24 hours';

-- Job 2: permanently delete past grace period (cascades to workout_exercises / sets)
DELETE FROM public.workouts
WHERE status = 'expired'
  AND expired_at < NOW() - INTERVAL '7 days';
```

### Introspection queries

```sql
-- List all registered cron jobs
SELECT jobid, jobname, schedule, active FROM cron.job;

-- View recent run history (pass/fail, duration)
SELECT jobid, jobname, status, start_time, end_time, return_message
FROM cron.job_run_details
ORDER BY start_time DESC
LIMIT 10;
```

### Manual verification

```sql
-- 1. Verify both jobs are registered after pnpm db:reset
SELECT jobname, schedule FROM cron.job
WHERE jobname IN (
  'limenfit_expire_inprogress_workouts',
  'limenfit_delete_expired_workouts'
);
-- Expected: 2 rows

-- 2. Test the expiry job (run the body inline)
UPDATE public.workouts
SET last_activity_at = NOW() - INTERVAL '25 hours'
WHERE id = '<test-workout-id>';

-- Then run the job body inline:
UPDATE public.workouts
SET status = 'expired', expired_at = NOW()
WHERE status = 'in_progress'
  AND last_activity_at < NOW() - INTERVAL '24 hours';
-- Expected: the row transitions to status = 'expired' with expired_at set

-- 3. Test the deletion job (run the body inline)
UPDATE public.workouts
SET expired_at = NOW() - INTERVAL '8 days'
WHERE id = '<test-workout-id>';

DELETE FROM public.workouts
WHERE status = 'expired'
  AND expired_at < NOW() - INTERVAL '7 days';
-- Expected: the row is deleted; workout_exercises and sets cascade-deleted
```

---

## AI assistant tables (T20b)

Two tables back the `/ask` AI assistant (see `lib/ai/README.md` and `app/api/ask/README.md`). Both are written **exclusively by the service-role client** (`lib/supabase/service-role.ts`) — the migrations intentionally declare no `INSERT`/`UPDATE`/`DELETE` policies, so RLS blocks every write that doesn't bypass it.

| Table             | Migration                                       | Purpose                                                                                       |
| ----------------- | ----------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `ai_chat_logs`    | `20260521000001_ai_chat_logs.sql`               | One row per assistant turn — `prompt_hash`, `tool_calls`, `tokens_in/out`, `latency_ms`, `status` (`ok` / `error` / `rate_limit` / `cost_cap`). `prompt_text` is nullable and only populated when `LIMENFIT_AI_LOG_PROMPT_TEXT=1`. |
| `ai_usage_daily`  | `20260521000002_ai_usage_daily.sql`             | Per-user, per-day token rollup keyed by `(user_id, date)`. Drives the durable daily cost cap in `lib/ai/costGuard.ts` — the real ceiling that survives across serverless instances. |

A third migration, `20260521000003_record_ai_tokens.sql`, installs the `record_ai_tokens(p_user_id, p_date, p_tokens_in, p_tokens_out)` RPC used by `recordTokens()` to upsert into `ai_usage_daily` atomically.

### RLS contract

Both tables have RLS enabled with a **read-only owner policy** and no write policies:

```sql
-- ai_chat_logs
CREATE POLICY ai_chat_logs_select ON public.ai_chat_logs
  FOR SELECT USING (user_id = auth.uid());

-- ai_usage_daily
CREATE POLICY ai_usage_daily_select ON public.ai_usage_daily
  FOR SELECT USING (user_id = auth.uid());
```

Practical consequences:

- **Anon / authenticated clients can only read their own rows.** No client (the browser, the user-scoped server client in route handlers, RSC, etc.) can insert or modify either table — the absence of write policies is intentional.
- **Only the service-role client writes.** `lib/ai/logging.ts` and `lib/ai/costGuard.ts` both use `createSupabaseServiceRoleClient()`, which bypasses RLS by design. Any future writer must use the same factory or add an explicit policy here.
- **Cascade on user delete** — both tables `REFERENCES auth.users(id) ON DELETE CASCADE`, so a deleted user's chat history and usage rollup are removed automatically.

---

### Local development note

The local Supabase stack (`pnpm db:start`) includes pg_cron. If a developer's local Docker image has pg_cron disabled, `pnpm db:reset` will surface a clear error at the `CREATE EXTENSION` step in this migration — no silent failure.
