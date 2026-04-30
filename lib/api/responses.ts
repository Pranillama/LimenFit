import type { ZodError } from 'zod';

import { ApiAuthError } from './auth';
import { IdempotencyValidationError } from '@/lib/idempotency/server';

export function jsonOk<T>(data: T, init?: ResponseInit): Response {
  return Response.json(data, { ...init, status: 200 });
}

export function jsonCreated<T>(data: T): Response {
  return Response.json(data, { status: 201 });
}

export function jsonError(
  status: number,
  code: string,
  message: string,
  extra?: Record<string, unknown>,
): Response {
  return Response.json(
    { error: { code, message, ...(extra !== undefined ? { details: extra } : {}) } },
    { status },
  );
}

/**
 * Maps well-known error types to structured JSON responses.
 *
 * ZodError                    → 400 VALIDATION_ERROR
 * ApiAuthError                → 401 UNAUTHORIZED
 * IdempotencyValidationError  → 400 IDEMPOTENCY_VALIDATION_ERROR
 * PostgREST 23505             → caller should handle before reaching here (unique violations
 *                               inside withIdempotency are already normalized to replay outcomes)
 *
 * Unknown errors are returned as 500 INTERNAL_SERVER_ERROR with server-side logging.
 */
export function handleApiError(err: unknown): Response {
  if (isZodError(err)) {
    return jsonError(400, 'VALIDATION_ERROR', 'Invalid request body', {
      issues: err.issues,
    });
  }
  if (err instanceof ApiAuthError) {
    return jsonError(401, 'UNAUTHORIZED', err.message);
  }
  if (err instanceof IdempotencyValidationError) {
    return jsonError(400, 'IDEMPOTENCY_VALIDATION_ERROR', err.message);
  }
  console.error('[handleApiError] Unhandled error:', err);
  return jsonError(500, 'INTERNAL_SERVER_ERROR', 'An unexpected error occurred');
}

function isZodError(err: unknown): err is ZodError {
  return (
    err !== null &&
    typeof err === 'object' &&
    'issues' in err &&
    Array.isArray((err as { issues: unknown }).issues)
  );
}
