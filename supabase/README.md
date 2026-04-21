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
