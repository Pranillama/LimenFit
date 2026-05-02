-- Add response_metadata field to mutation_receipts table
-- This field stores outcome metadata for the first successful execution,
-- allowing replays to reconstruct the original response shape accurately.

ALTER TABLE public.mutation_receipts
ADD COLUMN response_metadata jsonb DEFAULT NULL;

-- Add comment explaining the field's purpose
COMMENT ON COLUMN public.mutation_receipts.response_metadata IS
'Outcome metadata from the first successful handler execution. For create mutations like POST /api/workouts, stores the "alreadyExisted" status and other response-specific data needed to reconstruct the original response on replay.';
