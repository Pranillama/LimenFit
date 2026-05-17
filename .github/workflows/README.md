# .github/workflows

Two workflows ship with this repository:

| File                   | Trigger                                                                                                 | Responsibility                                                                                                      |
| ---------------------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `ci.yml`               | Every PR + every push to `main`                                                                         | Quality gate: lint, format check, type check, tests, and build. All five steps must pass before a PR can be merged. |
| `supabase-migrate.yml` | Push to `main` — path-filtered to `supabase/migrations/**`, `supabase/seed.sql`, `supabase/config.toml` | Applies pending migrations to the linked remote Supabase project via `supabase db push`.                            |

Vercel auto-deploys are triggered by the Vercel Git integration, **not** by these workflows. See the root `README.md` under `## Deployment` and `## CI/CD pipelines` for the full picture.
