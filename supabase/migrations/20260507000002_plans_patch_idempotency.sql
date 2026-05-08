-- Track the last applied PATCH mutation per plan for idempotent child replacement.
ALTER TABLE public.plans
  ADD COLUMN last_patch_mutation_id uuid;

-- Replace update_plan_with_children with a version that:
--   1. Acquires a row-level lock (FOR UPDATE) to serialize concurrent PATCH calls.
--   2. Returns immediately when last_patch_mutation_id already matches
--      p_client_mutation_id — child rows are not deleted/re-inserted a second time.
CREATE OR REPLACE FUNCTION public.update_plan_with_children(
  p_plan_id              uuid,
  p_name                 text,
  p_workouts             jsonb,
  p_client_mutation_id   uuid
)
RETURNS TABLE (plan_id uuid)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_existing_mutation_id uuid;
  v_workout_rec          RECORD;
  v_plan_workout_id      uuid;
  v_exercise_rec         RECORD;
BEGIN
  SELECT last_patch_mutation_id
  INTO v_existing_mutation_id
  FROM public.plans
  WHERE id = p_plan_id AND user_id = auth.uid()
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  IF v_existing_mutation_id = p_client_mutation_id THEN
    RETURN QUERY SELECT p_plan_id;
    RETURN;
  END IF;

  UPDATE public.plans
  SET name = p_name, last_patch_mutation_id = p_client_mutation_id
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

-- Idempotent name-only plan update with the same serialization guarantees:
-- SELECT FOR UPDATE serializes concurrent callers, and last_patch_mutation_id
-- prevents a duplicate in-flight request from advancing updated_at a second time.
CREATE OR REPLACE FUNCTION public.update_plan_name(
  p_plan_id              uuid,
  p_name                 text,
  p_client_mutation_id   uuid
)
RETURNS TABLE (plan_id uuid)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_existing_mutation_id uuid;
BEGIN
  SELECT last_patch_mutation_id
  INTO v_existing_mutation_id
  FROM public.plans
  WHERE id = p_plan_id AND user_id = auth.uid()
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  IF v_existing_mutation_id = p_client_mutation_id THEN
    RETURN QUERY SELECT p_plan_id;
    RETURN;
  END IF;

  UPDATE public.plans
  SET name = p_name, last_patch_mutation_id = p_client_mutation_id
  WHERE id = p_plan_id;

  RETURN QUERY SELECT p_plan_id;
END;
$$;
