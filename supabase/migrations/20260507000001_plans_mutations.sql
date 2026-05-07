-- Add client_mutation_id to plans for idempotent inserts.
-- A partial unique index (where not null) lets legacy rows coexist without constraints.
ALTER TABLE public.plans
  ADD COLUMN client_mutation_id uuid;

CREATE UNIQUE INDEX plans_client_mutation_id_unique
  ON public.plans(client_mutation_id)
  WHERE client_mutation_id IS NOT NULL;

-- Atomically create a plan with its workouts and exercises in one transaction.
-- p_workouts: [{name, position, exercises:[{exercise_id,target_sets,target_reps,position}]}]
-- Returns (plan_id, share_slug). Raises unique_violation (23505) on duplicate
-- client_mutation_id so the route's withIdempotency race path can recover.
-- SECURITY INVOKER: inherits the calling user's RLS context so auth.uid() is set.
CREATE OR REPLACE FUNCTION public.create_plan_with_children(
  p_name               text,
  p_workouts           jsonb,
  p_client_mutation_id uuid
)
RETURNS TABLE (plan_id uuid, share_slug text)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_plan_id         uuid;
  v_share_slug      text;
  v_workout_rec     RECORD;
  v_plan_workout_id uuid;
  v_exercise_rec    RECORD;
BEGIN
  INSERT INTO public.plans (user_id, name, client_mutation_id)
  VALUES (auth.uid(), p_name, p_client_mutation_id)
  RETURNING id, public.plans.share_slug INTO v_plan_id, v_share_slug;

  FOR v_workout_rec IN SELECT * FROM jsonb_array_elements(p_workouts) AS t(w)
  LOOP
    INSERT INTO public.plan_workouts (plan_id, name, position)
    VALUES (
      v_plan_id,
      v_workout_rec.w->>'name',
      (v_workout_rec.w->>'position')::integer
    )
    RETURNING id INTO v_plan_workout_id;

    FOR v_exercise_rec IN SELECT * FROM jsonb_array_elements(v_workout_rec.w->'exercises') AS t(e)
    LOOP
      INSERT INTO public.plan_exercises (plan_workout_id, exercise_id, target_sets, target_reps, position)
      VALUES (
        v_plan_workout_id,
        (v_exercise_rec.e->>'exercise_id')::uuid,
        (v_exercise_rec.e->>'target_sets')::integer,
        (v_exercise_rec.e->>'target_reps')::integer,
        (v_exercise_rec.e->>'position')::integer
      );
    END LOOP;
  END LOOP;

  RETURN QUERY SELECT v_plan_id, v_share_slug;
END;
$$;

-- Full-replace a plan's name and children.
-- Returns (plan_id) on success; returns zero rows if plan_id is not owned by
-- auth.uid() so the route can map to 404.
-- DELETE on plan_workouts cascades to plan_exercises via the existing ON DELETE CASCADE.
-- SECURITY INVOKER: inherits the calling user's RLS context so auth.uid() is set.
CREATE OR REPLACE FUNCTION public.update_plan_with_children(
  p_plan_id  uuid,
  p_name     text,
  p_workouts jsonb
)
RETURNS TABLE (plan_id uuid)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_workout_rec     RECORD;
  v_plan_workout_id uuid;
  v_exercise_rec    RECORD;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.plans WHERE id = p_plan_id AND user_id = auth.uid()
  ) THEN
    RETURN;
  END IF;

  UPDATE public.plans
  SET name = p_name
  WHERE id = p_plan_id;

  DELETE FROM public.plan_workouts pw WHERE pw.plan_id = p_plan_id;

  FOR v_workout_rec IN SELECT * FROM jsonb_array_elements(p_workouts) AS t(w)
  LOOP
    INSERT INTO public.plan_workouts (plan_id, name, position)
    VALUES (
      p_plan_id,
      v_workout_rec.w->>'name',
      (v_workout_rec.w->>'position')::integer
    )
    RETURNING id INTO v_plan_workout_id;

    FOR v_exercise_rec IN SELECT * FROM jsonb_array_elements(v_workout_rec.w->'exercises') AS t(e)
    LOOP
      INSERT INTO public.plan_exercises (plan_workout_id, exercise_id, target_sets, target_reps, position)
      VALUES (
        v_plan_workout_id,
        (v_exercise_rec.e->>'exercise_id')::uuid,
        (v_exercise_rec.e->>'target_sets')::integer,
        (v_exercise_rec.e->>'target_reps')::integer,
        (v_exercise_rec.e->>'position')::integer
      );
    END LOOP;
  END LOOP;

  RETURN QUERY SELECT p_plan_id;
END;
$$;
