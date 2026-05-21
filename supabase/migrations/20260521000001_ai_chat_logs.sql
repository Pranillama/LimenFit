-- ai_chat_logs
-- Stores one row per AI assistant request/response cycle for usage tracking and debugging.
-- Writes are performed exclusively by the service-role client (see lib/supabase/service-role.ts).
-- prompt_text is nullable and only populated when LIMENFIT_AI_LOG_PROMPT_TEXT=1.

CREATE TABLE public.ai_chat_logs (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at   timestamptz NOT NULL DEFAULT now(),
  prompt_hash  text        NOT NULL,
  prompt_text  text,
  tool_calls   jsonb       NOT NULL DEFAULT '[]'::jsonb,
  tokens_in    integer     NOT NULL,
  tokens_out   integer     NOT NULL,
  latency_ms   integer     NOT NULL,
  status       text        NOT NULL CHECK (status IN ('ok', 'error', 'rate_limit', 'cost_cap'))
);

CREATE INDEX ai_chat_logs_user_id_created_at ON public.ai_chat_logs(user_id, created_at DESC);

ALTER TABLE public.ai_chat_logs ENABLE ROW LEVEL SECURITY;

-- Only owners can read their own logs. No insert/update/delete policies:
-- the service-role client bypasses RLS and is the only writer.
CREATE POLICY ai_chat_logs_select ON public.ai_chat_logs
  FOR SELECT USING (user_id = auth.uid());
