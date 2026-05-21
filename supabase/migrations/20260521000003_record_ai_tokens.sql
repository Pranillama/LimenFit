-- record_ai_tokens
-- Atomically increment a user's daily AI token counters.
-- Uses INSERT ... ON CONFLICT DO UPDATE so concurrent callers cannot
-- overwrite each other's increments (read-modify-write in application
-- code is racy and undercounts under concurrent Ask streams).
CREATE OR REPLACE FUNCTION public.record_ai_tokens(
  p_user_id     uuid,
  p_date        date,
  p_tokens_in   integer,
  p_tokens_out  integer
)
RETURNS void
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $$
  INSERT INTO public.ai_usage_daily (user_id, date, tokens_in, tokens_out)
  VALUES (p_user_id, p_date, p_tokens_in, p_tokens_out)
  ON CONFLICT (user_id, date) DO UPDATE
  SET
    tokens_in  = public.ai_usage_daily.tokens_in  + EXCLUDED.tokens_in,
    tokens_out = public.ai_usage_daily.tokens_out + EXCLUDED.tokens_out;
$$;
