import { describe, it, expect, vi } from 'vitest';
import { resolveRequest, dispatchMutation } from '../queue';
import {
  buildWorkoutPatchMutation,
  buildWorkoutExerciseAddMutation,
  buildWorkoutExerciseReorderMutation,
  buildSetLogMutation,
  buildSetEditMutation,
} from '../mutationDescriptors';

// Minimal ok 2xx response that satisfies non-create mutation dispatch.
function ok200(): Response {
  return { status: 200, json: async () => ({}) } as unknown as Response;
}

// ok 2xx response for create mutations — echoes clientMutationId and provides an id.
function ok201(clientMutationId: string, id: string): Response {
  return {
    status: 201,
    json: async () => ({ id, clientMutationId }),
  } as unknown as Response;
}

// ─── resolveRequest ───────────────────────────────────────────────────────────

describe('resolveRequest', () => {
  describe('workout.patch', () => {
    it('returns a DispatchableRequest with the correct url when serverIds contains the workout localId', () => {
      const mutation = buildWorkoutPatchMutation({ localId: 'local-w1', name: 'Legs Day' });
      const result = resolveRequest(mutation, { 'local-w1': 'server-w1' });
      expect(result).not.toBeNull();
      expect(result?.url).toBe('/api/workouts/server-w1');
      expect(result?.method).toBe('PATCH');
      expect(result?.kind).toBe('workout.patch');
    });

    it('returns null when serverIds is empty (dependency unresolved)', () => {
      const mutation = buildWorkoutPatchMutation({ localId: 'local-w1', name: 'Legs Day' });
      expect(resolveRequest(mutation, {})).toBeNull();
    });

    it('returns null when serverIds does not contain the required localId', () => {
      const mutation = buildWorkoutPatchMutation({ localId: 'local-w1', name: 'Legs Day' });
      expect(resolveRequest(mutation, { 'other-local-id': 'server-other' })).toBeNull();
    });
  });

  describe('workoutExercise.add', () => {
    it('returns a DispatchableRequest when the workout localId is resolved', () => {
      const mutation = buildWorkoutExerciseAddMutation({
        localId: 'local-ex1',
        workoutLocalId: 'local-w1',
        exerciseId: 'ex-42',
        position: 1,
      });
      const result = resolveRequest(mutation, { 'local-w1': 'server-w1' });
      expect(result).not.toBeNull();
      expect(result?.url).toBe('/api/workout-exercises');
      expect(result?.method).toBe('POST');
      expect(result?.body).toMatchObject({ workoutId: 'server-w1', localId: 'local-ex1' });
    });

    it('returns null when serverIds is empty (dependency unresolved)', () => {
      const mutation = buildWorkoutExerciseAddMutation({
        localId: 'local-ex1',
        workoutLocalId: 'local-w1',
        exerciseId: 'ex-42',
        position: 1,
      });
      expect(resolveRequest(mutation, {})).toBeNull();
    });
  });

  describe('workoutExercise.reorder', () => {
    it('returns a DispatchableRequest when the exercise localId is resolved', () => {
      const mutation = buildWorkoutExerciseReorderMutation({
        localId: 'local-ex1',
        position: 3,
      });
      const result = resolveRequest(mutation, { 'local-ex1': 'server-ex1' });
      expect(result).not.toBeNull();
      expect(result?.url).toBe('/api/workout-exercises/server-ex1');
      expect(result?.method).toBe('PATCH');
      expect(result?.body).toMatchObject({ position: 3 });
    });

    it('returns null when serverIds is empty (dependency unresolved)', () => {
      const mutation = buildWorkoutExerciseReorderMutation({ localId: 'local-ex1', position: 3 });
      expect(resolveRequest(mutation, {})).toBeNull();
    });
  });

  describe('set.log', () => {
    it('returns a DispatchableRequest when the workoutExercise localId is resolved', () => {
      const mutation = buildSetLogMutation({
        localId: 'local-s1',
        workoutExerciseLocalId: 'local-ex1',
        setNumber: 1,
        reps: 10,
        weightValue: 60,
        weightUnit: 'kg',
        loggedAt: '2026-04-30T10:00:00Z',
      });
      const result = resolveRequest(mutation, { 'local-ex1': 'server-ex1' });
      expect(result).not.toBeNull();
      expect(result?.url).toBe('/api/sets');
      expect(result?.method).toBe('POST');
      expect(result?.body).toMatchObject({ workoutExerciseId: 'server-ex1', localId: 'local-s1' });
    });

    it('returns null when serverIds is empty (dependency unresolved)', () => {
      const mutation = buildSetLogMutation({
        localId: 'local-s1',
        workoutExerciseLocalId: 'local-ex1',
        setNumber: 1,
        reps: 10,
        weightValue: 60,
        weightUnit: 'kg',
        loggedAt: '2026-04-30T10:00:00Z',
      });
      expect(resolveRequest(mutation, {})).toBeNull();
    });
  });

  describe('set.edit', () => {
    it('returns a DispatchableRequest when the set localId is resolved', () => {
      const mutation = buildSetEditMutation({ localId: 'local-s1', reps: 12 });
      const result = resolveRequest(mutation, { 'local-s1': 'server-s1' });
      expect(result).not.toBeNull();
      expect(result?.url).toBe('/api/sets/server-s1');
      expect(result?.method).toBe('PATCH');
    });

    it('returns null when serverIds is empty (dependency unresolved)', () => {
      const mutation = buildSetEditMutation({ localId: 'local-s1', reps: 12 });
      expect(resolveRequest(mutation, {})).toBeNull();
    });
  });
});

// ─── dispatchMutation ────────────────────────────────────────────────────────

describe('dispatchMutation', () => {
  describe('workout.patch', () => {
    it('calls fetch exactly once with the resolved server URL when given a resolved request', async () => {
      const mutation = buildWorkoutPatchMutation({ localId: 'local-w1', name: 'Upper Body' });
      const resolved = resolveRequest(mutation, { 'local-w1': 'server-w1' })!;
      const mockFetch = vi.fn().mockResolvedValue(ok200());

      const result = await dispatchMutation(resolved, mockFetch as typeof fetch);

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/workouts/server-w1',
        expect.objectContaining({ method: 'PATCH' }),
      );
      expect(result.ok).toBe(true);
    });
  });

  describe('workoutExercise.add', () => {
    it('calls fetch exactly once with POST /api/workout-exercises when given a resolved request', async () => {
      const mutation = buildWorkoutExerciseAddMutation({
        localId: 'local-ex1',
        workoutLocalId: 'local-w1',
        exerciseId: 'ex-42',
        position: 1,
      });
      const resolved = resolveRequest(mutation, { 'local-w1': 'server-w1' })!;
      const cid = resolved.clientMutationId;
      const mockFetch = vi.fn().mockResolvedValue(ok201(cid, 'server-ex1'));

      const result = await dispatchMutation(resolved, mockFetch as typeof fetch);

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/workout-exercises',
        expect.objectContaining({ method: 'POST' }),
      );
      expect(result.ok).toBe(true);
      expect(result.serverId).toBe('server-ex1');
    });
  });

  describe('workoutExercise.reorder', () => {
    it('calls fetch exactly once with PATCH /api/workout-exercises/[id] when given a resolved request', async () => {
      const mutation = buildWorkoutExerciseReorderMutation({ localId: 'local-ex1', position: 2 });
      const resolved = resolveRequest(mutation, { 'local-ex1': 'server-ex1' })!;
      const mockFetch = vi.fn().mockResolvedValue(ok200());

      const result = await dispatchMutation(resolved, mockFetch as typeof fetch);

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/workout-exercises/server-ex1',
        expect.objectContaining({ method: 'PATCH' }),
      );
      expect(result.ok).toBe(true);
    });
  });

  describe('set.log', () => {
    it('calls fetch exactly once with POST /api/sets when given a resolved request', async () => {
      const mutation = buildSetLogMutation({
        localId: 'local-s1',
        workoutExerciseLocalId: 'local-ex1',
        setNumber: 1,
        reps: 8,
        weightValue: 80,
        weightUnit: 'kg',
        loggedAt: '2026-04-30T10:00:00Z',
      });
      const resolved = resolveRequest(mutation, { 'local-ex1': 'server-ex1' })!;
      const cid = resolved.clientMutationId;
      const mockFetch = vi.fn().mockResolvedValue(ok201(cid, 'server-s1'));

      const result = await dispatchMutation(resolved, mockFetch as typeof fetch);

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/sets',
        expect.objectContaining({ method: 'POST' }),
      );
      expect(result.ok).toBe(true);
      expect(result.serverId).toBe('server-s1');
    });
  });

  describe('set.edit', () => {
    it('calls fetch exactly once with PATCH /api/sets/[id] when given a resolved request', async () => {
      const mutation = buildSetEditMutation({ localId: 'local-s1', reps: 15 });
      const resolved = resolveRequest(mutation, { 'local-s1': 'server-s1' })!;
      const mockFetch = vi.fn().mockResolvedValue(ok200());

      const result = await dispatchMutation(resolved, mockFetch as typeof fetch);

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/sets/server-s1',
        expect.objectContaining({ method: 'PATCH' }),
      );
      expect(result.ok).toBe(true);
    });
  });
});
