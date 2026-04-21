-- updated_at trigger function
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- user_settings
CREATE TABLE public.user_settings (
  id                          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                     uuid        NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  weight_unit                 weight_unit NOT NULL DEFAULT 'lbs',
  rest_timer_default_seconds  integer     NOT NULL DEFAULT 90,
  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER set_updated_at_user_settings
  BEFORE UPDATE ON public.user_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- exercises
CREATE TABLE public.exercises (
  id          uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid    REFERENCES auth.users(id) ON DELETE CASCADE,
  name        text    NOT NULL,
  category    text    NOT NULL,
  equipment   text,
  is_custom   boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Global rows: user_id IS NULL, is_custom = false.
-- Custom rows: user_id IS NOT NULL, is_custom = true.
ALTER TABLE public.exercises
  ADD CONSTRAINT exercises_is_custom_matches_ownership
  CHECK (
    (user_id IS NULL AND is_custom = false) OR
    (user_id IS NOT NULL AND is_custom = true)
  );

CREATE INDEX exercises_user_id_category ON public.exercises(user_id, category);
CREATE INDEX exercises_category_equipment ON public.exercises(category, equipment);

-- plans
CREATE TABLE public.plans (
  id          uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        text    NOT NULL,
  is_public   boolean NOT NULL DEFAULT false,
  share_slug  text    NOT NULL UNIQUE DEFAULT public.generate_share_slug(),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX plans_user_id ON public.plans(user_id);

CREATE TRIGGER set_updated_at_plans
  BEFORE UPDATE ON public.plans
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- plan_workouts
CREATE TABLE public.plan_workouts (
  id          uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id     uuid    NOT NULL REFERENCES public.plans(id) ON DELETE CASCADE,
  name        text    NOT NULL,
  position    integer NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX plan_workouts_plan_id_position ON public.plan_workouts(plan_id, position);

-- plan_exercises
CREATE TABLE public.plan_exercises (
  id               uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_workout_id  uuid    NOT NULL REFERENCES public.plan_workouts(id) ON DELETE CASCADE,
  exercise_id      uuid    NOT NULL REFERENCES public.exercises(id) ON DELETE RESTRICT,
  target_sets      integer NOT NULL,
  target_reps      integer NOT NULL,
  position         integer NOT NULL
);

CREATE INDEX plan_exercises_plan_workout_id_position ON public.plan_exercises(plan_workout_id, position);

-- workouts
CREATE TABLE public.workouts (
  id                uuid           PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid           NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_workout_id   uuid           REFERENCES public.plan_workouts(id) ON DELETE SET NULL,
  name              text,
  status            workout_status NOT NULL DEFAULT 'in_progress',
  started_at        timestamptz    NOT NULL DEFAULT now(),
  completed_at      timestamptz,
  last_activity_at  timestamptz    NOT NULL DEFAULT now(),
  expired_at        timestamptz,
  created_at        timestamptz    NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX workouts_one_active_draft_per_user
  ON public.workouts(user_id) WHERE status = 'in_progress';

CREATE INDEX workouts_user_id_status ON public.workouts(user_id, status);
CREATE INDEX workouts_user_id_started_at ON public.workouts(user_id, started_at DESC);

-- workout_exercises
CREATE TABLE public.workout_exercises (
  id          uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  workout_id  uuid    NOT NULL REFERENCES public.workouts(id) ON DELETE CASCADE,
  exercise_id uuid    NOT NULL REFERENCES public.exercises(id) ON DELETE RESTRICT,
  position    integer NOT NULL
);

CREATE INDEX workout_exercises_workout_id_position ON public.workout_exercises(workout_id, position);

-- sets
CREATE TABLE public.sets (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  workout_exercise_id uuid        NOT NULL REFERENCES public.workout_exercises(id) ON DELETE CASCADE,
  set_number          integer     NOT NULL,
  weight_value        numeric(7,2) NOT NULL,
  weight_unit         weight_unit NOT NULL,
  reps                integer     NOT NULL,
  logged_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX sets_workout_exercise_id_set_number ON public.sets(workout_exercise_id, set_number);

-- mutation_receipts
CREATE TABLE public.mutation_receipts (
  client_mutation_id  uuid        PRIMARY KEY,
  user_id             uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mutation_type       text        NOT NULL,
  resource_type       text        NOT NULL,
  resource_id         uuid,
  processed_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX mutation_receipts_user_id_processed_at ON public.mutation_receipts(user_id, processed_at DESC);
