-- Add client_mutation_id to exercises for idempotent inserts.
-- A partial unique index (where not null) lets legacy rows coexist without constraints.
ALTER TABLE public.exercises
  ADD COLUMN client_mutation_id uuid;

CREATE UNIQUE INDEX exercises_client_mutation_id_unique
  ON public.exercises(client_mutation_id)
  WHERE client_mutation_id IS NOT NULL;
