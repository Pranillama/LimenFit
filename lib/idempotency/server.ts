import type { SupabaseClient } from '@supabase/supabase-js';

import { assertServerOnly } from '@/lib/env';
import type { Database } from '@/lib/supabase/types';

assertServerOnly();

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class IdempotencyValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'IdempotencyValidationError';
  }
}

export interface IdempotencyResult<T> {
  replayed: boolean;
  resourceId: string | null;
  /** Present on replay — echoes the mutation_type stored in the receipt. */
  mutationType?: string;
  /** Outcome metadata from the first successful execution, if available. */
  responseMetadata?: unknown;
  /** Null on a replay — caller reconstructs the success body from resourceId. */
  response: T | null;
}

interface WithIdempotencyOptions<T> {
  supabase: SupabaseClient<Database>;
  userId: string;
  clientMutationId: string;
  mutationType: string;
  resourceType: string;
  handler: () => Promise<{ resourceId: string | null; response: T; responseMetadata?: unknown }>;
}

/**
 * Deduplicates API mutations via the mutation_receipts table.
 *
 * On the first call for a given (clientMutationId, userId) pair, runs handler,
 * persists a receipt, and returns { replayed: false, resourceId, response }.
 *
 * On a replay, returns { replayed: true, resourceId, response: null }.
 * The caller is responsible for reconstructing the success response from
 * resourceId (e.g. re-fetching the existing row for create endpoints, or
 * returning a static success body for update/delete endpoints).
 *
 * A unique-violation on receipt insert (two concurrent identical requests)
 * is treated as a replay: the receipt from the winning request is re-read.
 */
export async function withIdempotency<T>(
  opts: WithIdempotencyOptions<T>,
): Promise<IdempotencyResult<T>> {
  const { supabase, userId, clientMutationId, mutationType, resourceType, handler } = opts;

  if (!UUID_RE.test(clientMutationId)) {
    throw new IdempotencyValidationError(
      `clientMutationId must be a v4 UUID, received: "${clientMutationId}"`,
    );
  }

  // Check for an existing receipt (RLS restricts rows to the calling user).
  const { data: existing, error: lookupError } = await supabase
    .from('mutation_receipts')
    .select('resource_id, mutation_type, response_metadata')
    .eq('client_mutation_id', clientMutationId)
    .eq('user_id', userId)
    .maybeSingle();

  if (lookupError) throw lookupError;

  if (existing) {
    return {
      replayed: true,
      resourceId: existing.resource_id,
      mutationType: existing.mutation_type,
      responseMetadata: existing.response_metadata,
      response: null,
    };
  }

  const { resourceId, response, responseMetadata } = await handler();

  const { error: insertError } = await supabase.from('mutation_receipts').insert({
    client_mutation_id: clientMutationId,
    user_id: userId,
    mutation_type: mutationType,
    resource_type: resourceType,
    resource_id: resourceId,
    response_metadata: (responseMetadata as any) ?? null,
  });

  if (insertError) {
    // PostgreSQL unique-violation: a concurrent request won the race — treat as replay.
    if (insertError.code === '23505') {
      const { data: raceReceipt, error: raceReadError } = await supabase
        .from('mutation_receipts')
        .select('resource_id, mutation_type, response_metadata')
        .eq('client_mutation_id', clientMutationId)
        .eq('user_id', userId)
        .maybeSingle();

      if (raceReadError) throw raceReadError;
      if (!raceReceipt) throw insertError;

      return {
        replayed: true,
        resourceId: raceReceipt.resource_id,
        mutationType: raceReceipt.mutation_type,
        responseMetadata: raceReceipt.response_metadata,
        response: null,
      };
    }
    throw insertError;
  }

  return { replayed: false, resourceId, response };
}
