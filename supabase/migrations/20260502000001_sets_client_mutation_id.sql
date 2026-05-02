-- Add client_mutation_id to sets for idempotent inserts.
-- A partial unique index (where not null) lets legacy rows coexist without constraints.
ALTER TABLE public.sets
  ADD COLUMN client_mutation_id uuid;

CREATE UNIQUE INDEX sets_client_mutation_id_unique
  ON public.sets(client_mutation_id)
  WHERE client_mutation_id IS NOT NULL;
