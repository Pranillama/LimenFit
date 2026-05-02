import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/lib/env', () => ({ assertServerOnly: () => {} }));

import { IdempotencyValidationError, withIdempotency } from './server';

describe('withIdempotency — response_metadata contract', () => {
  let receipts: Map<string, any>;
  let mockSupabase: any;

  beforeEach(() => {
    receipts = new Map();

    // Shared key builder
    const makeKey = (clientMutationId: string, userId: string) => `${clientMutationId}:${userId}`;

    // Build a realistic Supabase mock that actually stores on insert
    mockSupabase = {
      from: (table: string) => {
        if (table === 'mutation_receipts') {
          return {
            select: (cols: string) => {
              return {
                eq: (field1: string, value1: string) => {
                  return {
                    eq: (field2: string, value2: string) => ({
                      maybeSingle: async () => {
                        // Both eq calls must be for the lookup fields
                        let clientMutationId = '';
                        let userId = '';

                        // Determine which field is which
                        if (field1 === 'client_mutation_id') {
                          clientMutationId = value1;
                        } else if (field1 === 'user_id') {
                          userId = value1;
                        }

                        if (field2 === 'client_mutation_id') {
                          clientMutationId = value2;
                        } else if (field2 === 'user_id') {
                          userId = value2;
                        }

                        const key = makeKey(clientMutationId, userId);
                        const receipt = receipts.get(key);
                        return { data: receipt ?? null, error: null };
                      },
                    }),
                  };
                },
              };
            },
            insert: (data: any) => ({
              // Synchronously store to receipts on insert
              __stored: (() => {
                const key = makeKey(data.client_mutation_id, data.user_id);
                receipts.set(key, data);
                return true;
              })(),
              error: null,
              data: null,
            }),
          };
        }
        return {};
      },
    };
  });

  describe('Scenario 1: First call with existing-draft outcome', () => {
    it('should persist responseMetadata with alreadyExisted: true', async () => {
      const result = await withIdempotency({
        supabase: mockSupabase,
        userId: 'user-123',
        clientMutationId: '550e8400-e29b-41d4-a716-446655440001',
        mutationType: 'workout.create',
        resourceType: 'workouts',
        handler: async () => {
          return {
            resourceId: 'workout-existing',
            response: {
              id: 'workout-existing',
              alreadyExisted: true,
              message: 'Found existing draft',
            },
            responseMetadata: { alreadyExisted: true },
          };
        },
      });

      expect(result.replayed).toBe(false);
      expect(result.resourceId).toBe('workout-existing');
      expect(result.response).toEqual({
        id: 'workout-existing',
        alreadyExisted: true,
        message: 'Found existing draft',
      });

      // Verify receipt was stored with metadata
      const key = '550e8400-e29b-41d4-a716-446655440001:user-123';
      const storedReceipt = receipts.get(key);
      expect(storedReceipt).toBeDefined();
      expect(storedReceipt.response_metadata).toEqual({ alreadyExisted: true });
      expect(storedReceipt.mutation_type).toBe('workout.create');
    });
  });

  describe('Scenario 2: Replay of existing-draft create', () => {
    it('should return responseMetadata from storage on replay', async () => {
      const clientMutationId = '550e8400-e29b-41d4-a716-446655440002';
      const userId = 'user-123';
      const key = `${clientMutationId}:${userId}`;

      // Pre-populate receipt with existing-draft metadata
      receipts.set(key, {
        client_mutation_id: clientMutationId,
        user_id: userId,
        mutation_type: 'workout.create',
        resource_id: 'workout-existing',
        response_metadata: { alreadyExisted: true },
      });

      let handlerCalled = false;
      const result = await withIdempotency({
        supabase: mockSupabase as any,
        userId,
        clientMutationId,
        mutationType: 'workout.create',
        resourceType: 'workouts',
        handler: async () => {
          handlerCalled = true;
          throw new Error('Handler should not be called on replay');
        },
      });

      expect(handlerCalled).toBe(false);
      expect(result.replayed).toBe(true);
      expect(result.resourceId).toBe('workout-existing');
      expect(result.response).toBeNull();
      expect(result.responseMetadata).toEqual({ alreadyExisted: true });
      expect(result.mutationType).toBe('workout.create');
    });
  });

  describe('Scenario 3: First call with insert outcome', () => {
    it('should persist responseMetadata with alreadyExisted: false', async () => {
      const result = await withIdempotency({
        supabase: mockSupabase,
        userId: 'user-456',
        clientMutationId: '550e8400-e29b-41d4-a716-446655440003',
        mutationType: 'workout.create',
        resourceType: 'workouts',
        handler: async () => {
          return {
            resourceId: 'workout-new',
            response: {
              id: 'workout-new',
              alreadyExisted: false,
              message: 'Created new draft',
            },
            responseMetadata: { alreadyExisted: false },
          };
        },
      });

      expect(result.replayed).toBe(false);
      expect(result.resourceId).toBe('workout-new');
      expect(result.response?.alreadyExisted).toBe(false);

      // Verify receipt was stored with metadata
      const key = '550e8400-e29b-41d4-a716-446655440003:user-456';
      const storedReceipt = receipts.get(key);
      expect(storedReceipt).toBeDefined();
      expect(storedReceipt.response_metadata).toEqual({ alreadyExisted: false });
      expect(storedReceipt.mutation_type).toBe('workout.create');
    });
  });

  describe('Scenario 4: Replay of insert create', () => {
    it('should return responseMetadata for insert outcome on replay', async () => {
      const clientMutationId = '550e8400-e29b-41d4-a716-446655440004';
      const userId = 'user-456';
      const key = `${clientMutationId}:${userId}`;

      // Pre-populate receipt with insert metadata
      receipts.set(key, {
        client_mutation_id: clientMutationId,
        user_id: userId,
        mutation_type: 'workout.create',
        resource_id: 'workout-new',
        response_metadata: { alreadyExisted: false },
      });

      const result = await withIdempotency({
        supabase: mockSupabase as any,
        userId,
        clientMutationId,
        mutationType: 'workout.create',
        resourceType: 'workouts',
        handler: async () => {
          throw new Error('Handler should not be called on replay');
        },
      });

      expect(result.replayed).toBe(true);
      expect(result.resourceId).toBe('workout-new');
      expect(result.response).toBeNull();
      expect(result.responseMetadata).toEqual({ alreadyExisted: false });
    });
  });

  describe('UUID validation', () => {
    it('should reject invalid clientMutationId', async () => {
      expect(
        withIdempotency({
          supabase: mockSupabase as any,
          userId: 'user-123',
          clientMutationId: 'not-a-uuid',
          mutationType: 'workout.create',
          resourceType: 'workouts',
          handler: async () => ({ resourceId: null, response: null }),
        }),
      ).rejects.toThrow(IdempotencyValidationError);
    });
  });

  describe('mutation_type preservation', () => {
    it('should store and return the logical mutation_type, not outcome-specific values', async () => {
      const clientMutationId = '550e8400-e29b-41d4-a716-446655440005';
      const userId = 'user-789';
      const key = `${clientMutationId}:${userId}`;

      // Pre-populate receipt
      receipts.set(key, {
        client_mutation_id: clientMutationId,
        user_id: userId,
        mutation_type: 'workout.create', // Not 'workout.create.existed' or similar
        resource_id: 'workout-id',
        response_metadata: { alreadyExisted: true },
      });

      const result = await withIdempotency({
        supabase: mockSupabase as any,
        userId,
        clientMutationId,
        mutationType: 'workout.create',
        resourceType: 'workouts',
        handler: async () => {
          throw new Error('Should not be called');
        },
      });

      expect(result.mutationType).toBe('workout.create');
      expect(result.mutationType).not.toContain('existed');
    });
  });

  describe('Handler optionality of responseMetadata', () => {
    it('should handle handlers that do not return responseMetadata', async () => {
      const result = await withIdempotency({
        supabase: mockSupabase as any,
        userId: 'user-123',
        clientMutationId: '550e8400-e29b-41d4-a716-446655440006',
        mutationType: 'workout.patch',
        resourceType: 'workouts',
        handler: async () => {
          return {
            resourceId: 'workout-id',
            response: { id: 'workout-id', success: true },
            // No responseMetadata
          };
        },
      });

      expect(result.replayed).toBe(false);
      expect(result.response).toEqual({ id: 'workout-id', success: true });

      const key = '550e8400-e29b-41d4-a716-446655440006:user-123';
      const storedReceipt = receipts.get(key);
      expect(storedReceipt.response_metadata).toBeNull();
    });
  });
});
