# supabase

Database migrations and seed data.

- `migrations/` will be populated with schema migrations in T3.
- `seed.sql` is owned by T3 (currently empty).
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

## No-op migration verification (acceptance criterion #4)

To verify the end-to-end migration workflow without committing real schema, run the following against your local Supabase instance:

```bash
pnpm exec supabase migration new noop_check
pnpm db:reset
```

**Delete the generated noop file** (`supabase/migrations/*_noop_check.sql`) before committing — it is intentionally transient and must not land in the repo. Real schema migrations are owned by T3.

---

## Phase 1 schema acceptance verification

Run these checks after `pnpm db:reset` completes with no errors.

### 1. Clean reset

```bash
pnpm db:reset
# Expected: all 4 migrations apply with no errors
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

### Local development note

The local Supabase stack (`pnpm db:start`) includes pg_cron. If a developer's local Docker image has pg_cron disabled, `pnpm db:reset` will surface a clear error at the `CREATE EXTENSION` step in this migration — no silent failure.
