-- Enable RLS on all tables
ALTER TABLE public.user_settings     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exercises         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plans             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plan_workouts     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plan_exercises    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workouts          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workout_exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sets              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mutation_receipts ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- user_settings
-- ============================================================
CREATE POLICY user_settings_select ON public.user_settings
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY user_settings_insert ON public.user_settings
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY user_settings_update ON public.user_settings
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY user_settings_delete ON public.user_settings
  FOR DELETE USING (user_id = auth.uid());

-- ============================================================
-- exercises
-- Global library rows have user_id IS NULL and are readable by anyone.
-- Custom rows are readable/writable only by their owner.
-- INSERT enforces that non-service callers cannot insert NULL user_id.
-- ============================================================
CREATE POLICY exercises_select ON public.exercises
  FOR SELECT USING (user_id IS NULL OR user_id = auth.uid());

CREATE POLICY exercises_insert ON public.exercises
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY exercises_update ON public.exercises
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY exercises_delete ON public.exercises
  FOR DELETE USING (user_id = auth.uid());

-- ============================================================
-- plans
-- Owners see all their plans; anyone (including anon) can read public plans.
-- ============================================================
CREATE POLICY plans_select ON public.plans
  FOR SELECT USING (user_id = auth.uid() OR is_public = true);

CREATE POLICY plans_insert ON public.plans
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY plans_update ON public.plans
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY plans_delete ON public.plans
  FOR DELETE USING (user_id = auth.uid());

-- ============================================================
-- plan_workouts
-- Readable when the parent plan is owned by the caller or is public.
-- Writable only when the parent plan is owned by the caller.
-- ============================================================
CREATE POLICY plan_workouts_select ON public.plan_workouts
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.plans p
      WHERE p.id = plan_id
        AND (p.user_id = auth.uid() OR p.is_public = true)
    )
  );

CREATE POLICY plan_workouts_insert ON public.plan_workouts
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.plans p
      WHERE p.id = plan_id AND p.user_id = auth.uid()
    )
  );

CREATE POLICY plan_workouts_update ON public.plan_workouts
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.plans p
      WHERE p.id = plan_id AND p.user_id = auth.uid()
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.plans p
      WHERE p.id = plan_id AND p.user_id = auth.uid()
    )
  );

CREATE POLICY plan_workouts_delete ON public.plan_workouts
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.plans p
      WHERE p.id = plan_id AND p.user_id = auth.uid()
    )
  );

-- ============================================================
-- plan_exercises
-- Readable when the grandparent plan is owned or public.
-- Writable only when the grandparent plan is owned.
-- ============================================================
CREATE POLICY plan_exercises_select ON public.plan_exercises
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.plan_workouts pw
      JOIN public.plans p ON p.id = pw.plan_id
      WHERE pw.id = plan_workout_id
        AND (p.user_id = auth.uid() OR p.is_public = true)
    )
  );

CREATE POLICY plan_exercises_insert ON public.plan_exercises
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.plan_workouts pw
      JOIN public.plans p ON p.id = pw.plan_id
      WHERE pw.id = plan_workout_id AND p.user_id = auth.uid()
    )
  );

CREATE POLICY plan_exercises_update ON public.plan_exercises
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.plan_workouts pw
      JOIN public.plans p ON p.id = pw.plan_id
      WHERE pw.id = plan_workout_id AND p.user_id = auth.uid()
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.plan_workouts pw
      JOIN public.plans p ON p.id = pw.plan_id
      WHERE pw.id = plan_workout_id AND p.user_id = auth.uid()
    )
  );

CREATE POLICY plan_exercises_delete ON public.plan_exercises
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.plan_workouts pw
      JOIN public.plans p ON p.id = pw.plan_id
      WHERE pw.id = plan_workout_id AND p.user_id = auth.uid()
    )
  );

-- ============================================================
-- workouts
-- ============================================================
CREATE POLICY workouts_select ON public.workouts
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY workouts_insert ON public.workouts
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY workouts_update ON public.workouts
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY workouts_delete ON public.workouts
  FOR DELETE USING (user_id = auth.uid());

-- ============================================================
-- workout_exercises
-- ============================================================
CREATE POLICY workout_exercises_select ON public.workout_exercises
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.workouts w
      WHERE w.id = workout_id AND w.user_id = auth.uid()
    )
  );

CREATE POLICY workout_exercises_insert ON public.workout_exercises
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.workouts w
      WHERE w.id = workout_id AND w.user_id = auth.uid()
    )
  );

CREATE POLICY workout_exercises_update ON public.workout_exercises
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.workouts w
      WHERE w.id = workout_id AND w.user_id = auth.uid()
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.workouts w
      WHERE w.id = workout_id AND w.user_id = auth.uid()
    )
  );

CREATE POLICY workout_exercises_delete ON public.workout_exercises
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.workouts w
      WHERE w.id = workout_id AND w.user_id = auth.uid()
    )
  );

-- ============================================================
-- sets
-- ============================================================
CREATE POLICY sets_select ON public.sets
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.workout_exercises we
      JOIN public.workouts w ON w.id = we.workout_id
      WHERE we.id = workout_exercise_id AND w.user_id = auth.uid()
    )
  );

CREATE POLICY sets_insert ON public.sets
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.workout_exercises we
      JOIN public.workouts w ON w.id = we.workout_id
      WHERE we.id = workout_exercise_id AND w.user_id = auth.uid()
    )
  );

CREATE POLICY sets_update ON public.sets
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.workout_exercises we
      JOIN public.workouts w ON w.id = we.workout_id
      WHERE we.id = workout_exercise_id AND w.user_id = auth.uid()
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.workout_exercises we
      JOIN public.workouts w ON w.id = we.workout_id
      WHERE we.id = workout_exercise_id AND w.user_id = auth.uid()
    )
  );

CREATE POLICY sets_delete ON public.sets
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.workout_exercises we
      JOIN public.workouts w ON w.id = we.workout_id
      WHERE we.id = workout_exercise_id AND w.user_id = auth.uid()
    )
  );

-- ============================================================
-- mutation_receipts
-- ============================================================
CREATE POLICY mutation_receipts_select ON public.mutation_receipts
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY mutation_receipts_insert ON public.mutation_receipts
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY mutation_receipts_update ON public.mutation_receipts
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY mutation_receipts_delete ON public.mutation_receipts
  FOR DELETE USING (user_id = auth.uid());
