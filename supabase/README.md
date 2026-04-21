# supabase

Database migrations and seed data.

- Migrations implemented in T2 (a5105531-25cd-492a-b63a-a9126484fe6c) and T3.
- `functions/` is reserved for Supabase Edge Functions and is not used in Phase 1.

---

## Local development

Start the full local Postgres + Auth + Studio + Storage stack (requires Docker Desktop):

```bash
pnpm db:start
```

Stop it:

```bash
pnpm db:stop
```

Re-apply all migrations and seed data against the local DB:

```bash
pnpm db:reset
```

Apply pending local migrations to the linked remote project:

```bash
pnpm db:push
```

Generate a new migration file from local schema drift:

```bash
pnpm db:diff
```

---

## No-op migration verification (acceptance criterion #4)

To verify the end-to-end migration workflow without committing real schema, run the two commands below against your local Supabase instance:

```bash
pnpm exec supabase migration new noop_check
pnpm db:reset
```

**Delete the generated noop file** (`supabase/migrations/*_noop_check.sql`) before committing — it is intentionally transient and must not land in the repo. Real schema migrations are owned by T3.
