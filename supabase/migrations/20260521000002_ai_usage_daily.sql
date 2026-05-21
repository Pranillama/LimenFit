-- ai_usage_daily
-- Per-user, per-day rollup of AI token usage for cost capping.
-- Writes are performed exclusively by the service-role client (see lib/supabase/service-role.ts).

CREATE TABLE public.ai_usage_daily (
  user_id     uuid    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date        date    NOT NULL,
  tokens_in   integer NOT NULL DEFAULT 0,
  tokens_out  integer NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, date)
);

ALTER TABLE public.ai_usage_daily ENABLE ROW LEVEL SECURITY;

-- Only owners can read their own usage. No insert/update/delete policies:
-- the service-role client bypasses RLS and is the only writer.
CREATE POLICY ai_usage_daily_select ON public.ai_usage_daily
  FOR SELECT USING (user_id = auth.uid());
