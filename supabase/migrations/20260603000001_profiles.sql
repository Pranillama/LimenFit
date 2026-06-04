-- New enums for profile fields
CREATE TYPE height_unit          AS ENUM ('ft', 'cm');
CREATE TYPE fitness_goal         AS ENUM ('fat_loss', 'muscle_gain', 'strength', 'endurance', 'general_fitness');
CREATE TYPE activity_level       AS ENUM ('sedentary', 'lightly_active', 'moderately_active', 'very_active');
CREATE TYPE training_experience  AS ENUM ('beginner', 'intermediate', 'advanced');
CREATE TYPE gender               AS ENUM ('male', 'female', 'prefer_not_to_say');

-- Extend user_settings with display height unit; weight unit + rest timer remain.
ALTER TABLE public.user_settings
  ADD COLUMN height_unit height_unit NOT NULL DEFAULT 'ft';

-- profiles: one row per user, holds identity + fitness fields.
-- All weight values stored in kg, all heights in cm. Display conversion is client-side.
CREATE TABLE public.profiles (
  id                          uuid                PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                     uuid                NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Personal info
  first_name                  text,
  last_name                   text,
  display_name                text,
  username                    text                UNIQUE,
  avatar_url                  text,
  date_of_birth               date,
  gender                      gender,
  height_cm                   numeric(5,2),
  starting_weight_kg          numeric(6,2),
  time_zone                   text,

  -- Fitness profile
  primary_goal                fitness_goal,
  goal_weight_kg              numeric(6,2),
  target_daily_calories       integer,
  activity_level              activity_level,
  training_experience         training_experience,
  weekly_training_frequency   smallint            CHECK (weekly_training_frequency BETWEEN 2 AND 6),

  created_at                  timestamptz         NOT NULL DEFAULT now(),
  updated_at                  timestamptz         NOT NULL DEFAULT now()
);

CREATE TRIGGER set_updated_at_profiles
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY profiles_select ON public.profiles
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY profiles_insert ON public.profiles
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY profiles_update ON public.profiles
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY profiles_delete ON public.profiles
  FOR DELETE USING (user_id = auth.uid());
