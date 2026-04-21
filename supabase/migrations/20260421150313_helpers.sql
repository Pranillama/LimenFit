CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION public.generate_share_slug()
RETURNS text
LANGUAGE sql
AS $$
  SELECT replace(
    translate(encode(gen_random_bytes(16), 'base64'), '+/=', '-_'),
    chr(10),
    ''
  );
$$;
