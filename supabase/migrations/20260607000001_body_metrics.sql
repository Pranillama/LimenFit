-- Body metrics: per-user, per-day time-series for bodyweight and measurements.
-- All weights stored in kg, all lengths in cm. Display conversion is client-side.
-- One row per (user, day); the API upserts on (user_id, recorded_on) so logging
-- twice in a day updates that day's row rather than creating duplicates.

CREATE TABLE public.bodyweight_entries (
  id           uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid          NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  weight_kg    numeric(6,2)  NOT NULL CHECK (weight_kg > 0 AND weight_kg <= 500),
  recorded_on  date          NOT NULL DEFAULT (now() AT TIME ZONE 'utc')::date,
  created_at   timestamptz   NOT NULL DEFAULT now(),
  updated_at   timestamptz   NOT NULL DEFAULT now(),
  UNIQUE (user_id, recorded_on)
);

CREATE INDEX bodyweight_entries_user_date_idx
  ON public.bodyweight_entries (user_id, recorded_on);

CREATE TABLE public.body_measurements (
  id            uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid          NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recorded_on   date          NOT NULL DEFAULT (now() AT TIME ZONE 'utc')::date,
  body_fat_pct  numeric(4,1)  CHECK (body_fat_pct >= 0 AND body_fat_pct <= 100),
  waist_cm      numeric(5,1)  CHECK (waist_cm > 0 AND waist_cm <= 500),
  chest_cm      numeric(5,1)  CHECK (chest_cm > 0 AND chest_cm <= 500),
  arms_cm       numeric(5,1)  CHECK (arms_cm > 0 AND arms_cm <= 500),
  legs_cm       numeric(5,1)  CHECK (legs_cm > 0 AND legs_cm <= 500),
  created_at    timestamptz   NOT NULL DEFAULT now(),
  updated_at    timestamptz   NOT NULL DEFAULT now(),
  UNIQUE (user_id, recorded_on)
);

CREATE INDEX body_measurements_user_date_idx
  ON public.body_measurements (user_id, recorded_on);

CREATE TRIGGER set_updated_at_bodyweight_entries
  BEFORE UPDATE ON public.bodyweight_entries
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_updated_at_body_measurements
  BEFORE UPDATE ON public.body_measurements
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS: owner-only access on both tables.
ALTER TABLE public.bodyweight_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.body_measurements ENABLE ROW LEVEL SECURITY;

CREATE POLICY bodyweight_entries_select ON public.bodyweight_entries
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY bodyweight_entries_insert ON public.bodyweight_entries
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY bodyweight_entries_update ON public.bodyweight_entries
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY bodyweight_entries_delete ON public.bodyweight_entries
  FOR DELETE USING (user_id = auth.uid());

CREATE POLICY body_measurements_select ON public.body_measurements
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY body_measurements_insert ON public.body_measurements
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY body_measurements_update ON public.body_measurements
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY body_measurements_delete ON public.body_measurements
  FOR DELETE USING (user_id = auth.uid());
