-- Comment 3: Add client_mutation_id to workout_exercises for idempotent inserts.
-- A partial unique index (where not null) lets legacy rows coexist without constraints.
ALTER TABLE public.workout_exercises
  ADD COLUMN client_mutation_id uuid;

CREATE UNIQUE INDEX workout_exercises_client_mutation_id_unique
  ON public.workout_exercises(client_mutation_id)
  WHERE client_mutation_id IS NOT NULL;

-- Comment 1: Atomically reorder a workout_exercise only when the parent workout
-- is in_progress.  Returns the updated row; returns 0 rows when no row matches
-- (workout_exercise not found, wrong owner, or parent not in_progress).
-- SECURITY INVOKER: inherits the calling user's RLS context so auth.uid() is set.
CREATE OR REPLACE FUNCTION public.reorder_workout_exercise(
  p_workout_exercise_id uuid,
  p_position           integer
)
RETURNS TABLE (id uuid, workout_id uuid)
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $$
  UPDATE public.workout_exercises
  SET    position = p_position
  WHERE  id = p_workout_exercise_id
    AND  workout_id IN (
           SELECT w.id
           FROM   public.workouts w
           WHERE  w.user_id = auth.uid()
             AND  w.status  = 'in_progress'
         )
  RETURNING public.workout_exercises.id,
            public.workout_exercises.workout_id;
$$;

-- Comment 2: Resolve a workout_exercise through its parent workout and delete it
-- only when the parent is in_progress.
--
-- Return shape:
--   deleted = false, workout_id = null  → row not found (idempotent success)
--   deleted = false, workout_id = <id>  → row exists but parent not in_progress
--   deleted = true,  workout_id = <id>  → row deleted successfully
--
-- SECURITY INVOKER: inherits the calling user's RLS context so auth.uid() is set.
CREATE OR REPLACE FUNCTION public.delete_workout_exercise_in_progress(
  p_workout_exercise_id uuid
)
RETURNS TABLE (deleted boolean, workout_id uuid, workout_status text)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_workout_id uuid;
  v_status     text;
BEGIN
  -- RLS on workout_exercises and workouts enforces ownership automatically.
  SELECT w.id, w.status::text
  INTO   v_workout_id, v_status
  FROM   public.workout_exercises we
  JOIN   public.workouts w ON w.id = we.workout_id
  WHERE  we.id = p_workout_exercise_id;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, NULL::uuid, NULL::text;
    RETURN;
  END IF;

  IF v_status <> 'in_progress' THEN
    RETURN QUERY SELECT false, v_workout_id, v_status;
    RETURN;
  END IF;

  -- Constrain the delete to the resolved in-progress parent so a concurrent
  -- status transition cannot corrupt completed workout history.
  DELETE FROM public.workout_exercises
  WHERE  id         = p_workout_exercise_id
    AND  workout_id IN (
           SELECT w.id
           FROM   public.workouts w
           WHERE  w.user_id = auth.uid()
             AND  w.status  = 'in_progress'
         );

  RETURN QUERY SELECT true, v_workout_id, v_status;
END;
$$;
