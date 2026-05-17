import type {
  QueuedMutation,
  ActiveWorkoutMeta,
  ActiveWorkoutExercise,
  SyncState,
  TombstoneMap,
} from './types';
import {
  buildWorkoutDiscardMutation,
  buildWorkoutExerciseRemoveMutation,
  buildSetDeleteMutation,
} from './mutationDescriptors';

// ---------- Store interface consumed by the engine ----------

export interface FlushableStore {
  getState(): {
    meta: ActiveWorkoutMeta | null;
    exercises: ActiveWorkoutExercise[];
    sync: SyncState;
  };
  getQueue(): QueuedMutation[];
  getTombstones(): TombstoneMap;
  clearTombstone(localId: string): void;
  applyServerIds(map: Record<string, string>): void;
  setSyncState(patch: Partial<SyncState>): void;
  dropMutation(clientMutationId: string): void;
  incrementAttempt(clientMutationId: string): void;
  quarantineMutation(clientMutationId: string): void;
  enqueueMutation(mutation: QueuedMutation): void;
}

// ---------- Result types ----------

export interface MutationResult {
  ok: boolean;
  serverId: string | null;
  clientMutationId: string;
  retriable: boolean;
  status: number | null;
}

// ---------- Tiny structured logger (console only, no new deps) ----------

const log = {
  warn: (msg: string, ...args: unknown[]) => console.warn(`[queue] ${msg}`, ...args),
  error: (msg: string, ...args: unknown[]) => console.error(`[queue] ${msg}`, ...args),
};

// ---------- Backoff ----------

const MAX_BACKOFF_MS = 30_000;

function backoffMs(attempts: number): number {
  return Math.min(1_000 * 2 ** attempts, MAX_BACKOFF_MS);
}

// ---------- Module-level flush state ----------

let _flushInFlight = false;
let _retryTimer: ReturnType<typeof setTimeout> | null = null;

function clearRetryTimer(): void {
  if (_retryTimer !== null) {
    clearTimeout(_retryTimer);
    _retryTimer = null;
  }
}

function scheduleRetry(store: FlushableStore, fetchImpl: typeof fetch, delayMs: number): void {
  clearRetryTimer();
  _retryTimer = setTimeout(() => {
    _retryTimer = null;
    void flushQueue(store, fetchImpl);
  }, delayMs);
}

/** Cancel any pending backoff retry. Called by the hook on unmount. */
export function cancelPendingRetry(): void {
  clearRetryTimer();
}

// ---------- ID resolution ----------

type StateSnapshot = { meta: ActiveWorkoutMeta | null; exercises: ActiveWorkoutExercise[] };

function buildServerIdMap(state: StateSnapshot): Record<string, string> {
  const map: Record<string, string> = {};
  if (state.meta !== null && state.meta.workoutId !== null) {
    map[state.meta.localId] = state.meta.workoutId;
  }
  for (const ex of state.exercises) {
    if (ex.serverId !== null) map[ex.localId] = ex.serverId;
    for (const s of ex.sets) {
      if (s.serverId !== null) map[s.localId] = s.serverId;
    }
  }
  return map;
}

// ---------- Internal HTTP request builder ----------

interface ResolvedRequest {
  url: string;
  method: string;
  body: Record<string, unknown>;
}

function buildRequest(
  mutation: QueuedMutation,
  serverIds: Readonly<Record<string, string>>,
): ResolvedRequest | null {
  const { kind, payload, clientMutationId } = mutation;
  const idBase = { clientMutationId };

  switch (kind) {
    case 'workout.create': {
      return {
        url: '/api/workouts',
        method: 'POST',
        body: { ...idBase, ...payload },
      };
    }

    case 'workout.patch': {
      const sid = serverIds[payload.localId];
      if (!sid) return null;
      const { localId: _localId, ...fields } = payload;
      return {
        url: `/api/workouts/${sid}`,
        method: 'PATCH',
        body: { ...idBase, ...fields },
      };
    }

    case 'workout.discard': {
      // Use the server ID embedded at enqueue time first (survives meta being cleared).
      const sid = payload.workoutId ?? serverIds[payload.localId];
      if (!sid) return null;
      return {
        url: `/api/workouts/${sid}`,
        method: 'DELETE',
        body: { ...idBase },
      };
    }

    case 'workout.restore': {
      const sid = serverIds[payload.localId];
      if (!sid) return null;
      return {
        url: `/api/workouts/${sid}/restore`,
        method: 'POST',
        body: { ...idBase },
      };
    }

    case 'workoutExercise.add': {
      const workoutSid = serverIds[payload.workoutLocalId];
      if (!workoutSid) return null;
      return {
        url: '/api/workout-exercises',
        method: 'POST',
        body: {
          ...idBase,
          localId: payload.localId,
          workoutId: workoutSid,
          exerciseId: payload.exerciseId,
          position: payload.position,
        },
      };
    }

    case 'workoutExercise.remove': {
      // Use the server ID embedded at enqueue time first (survives entity being removed from state).
      const sid = payload.serverId ?? serverIds[payload.localId];
      if (!sid) return null;
      return {
        url: `/api/workout-exercises/${sid}`,
        method: 'DELETE',
        body: { ...idBase },
      };
    }

    case 'workoutExercise.reorder': {
      const sid = serverIds[payload.localId];
      if (!sid) return null;
      return {
        url: `/api/workout-exercises/${sid}`,
        method: 'PATCH',
        body: { ...idBase, position: payload.position },
      };
    }

    case 'set.log': {
      const weSid = serverIds[payload.workoutExerciseLocalId];
      if (!weSid) return null;
      return {
        url: '/api/sets',
        method: 'POST',
        body: {
          ...idBase,
          localId: payload.localId,
          workoutExerciseId: weSid,
          setNumber: payload.setNumber,
          reps: payload.reps,
          weightValue: payload.weightValue,
          weightUnit: payload.weightUnit,
          loggedAt: payload.loggedAt,
        },
      };
    }

    case 'set.edit': {
      const sid = serverIds[payload.localId];
      if (!sid) return null;
      const { localId: _localId, ...fields } = payload;
      return {
        url: `/api/sets/${sid}`,
        method: 'PATCH',
        body: { ...idBase, ...fields },
      };
    }

    case 'set.delete': {
      // Use the server ID embedded at enqueue time first (survives entity being removed from state).
      const sid = payload.serverId ?? serverIds[payload.localId];
      if (!sid) return null;
      return {
        url: `/api/sets/${sid}`,
        method: 'DELETE',
        body: { ...idBase },
      };
    }

    default:
      return null;
  }
}

// ---------- Public dispatchable request ----------

/**
 * A fully resolved, ready-to-dispatch HTTP request produced by resolveRequest().
 * All server IDs are embedded; no local IDs remain. Pass this to dispatchMutation().
 */
export interface DispatchableRequest {
  url: string;
  method: string;
  body: Record<string, unknown>;
  kind: QueuedMutation['kind'];
  clientMutationId: string;
}

/**
 * Resolves a queued mutation into a dispatchable HTTP request by substituting
 * local IDs with server IDs from the provided map.
 *
 * Returns null when a required server ID is absent from the map — the caller must
 * wait until the dependency is resolved (e.g., by a preceding create mutation
 * completing) before dispatching.
 *
 * flushQueue() builds the serverIds map from live store state and calls this before
 * every dispatch. Consumers that dispatch outside the flush path must supply a
 * complete, up-to-date server-id map.
 */
export function resolveRequest(
  mutation: QueuedMutation,
  serverIds: Readonly<Record<string, string>>,
): DispatchableRequest | null {
  const req = buildRequest(mutation, serverIds);
  if (req === null) return null;
  return {
    ...req,
    kind: mutation.kind,
    clientMutationId: mutation.clientMutationId,
  };
}

// ---------- Mutation kinds whose success carries a new server ID ----------

function isCreateKind(kind: QueuedMutation['kind']): boolean {
  return kind === 'workout.create' || kind === 'workoutExercise.add' || kind === 'set.log';
}

function localIdForCreate(mutation: QueuedMutation): string | null {
  if (
    mutation.kind === 'workout.create' ||
    mutation.kind === 'workoutExercise.add' ||
    mutation.kind === 'set.log'
  ) {
    return mutation.payload.localId;
  }
  return null;
}

// Returns true when the entity identified by localId is still present in live state.
// A false result means the entity was deleted optimistically while its create was in flight.
function isEntityInState(
  state: StateSnapshot,
  localId: string,
  kind: QueuedMutation['kind'],
): boolean {
  if (kind === 'workout.create') {
    // discardDraft() clears meta; a new workout would have a different localId.
    return state.meta !== null && state.meta.localId === localId;
  }
  if (kind === 'workoutExercise.add') {
    return state.exercises.some((ex) => ex.localId === localId);
  }
  if (kind === 'set.log') {
    return state.exercises.some((ex) => ex.sets.some((s) => s.localId === localId));
  }
  return true;
}

// Builds a compensating server-side delete for an entity that was created on the server
// but removed locally while the create request was in flight.
function buildCompensatingDeleteMutation(
  kind: QueuedMutation['kind'],
  localId: string,
  serverId: string,
  state: StateSnapshot,
): QueuedMutation | null {
  if (kind === 'workout.create') {
    // Embed the server ID so the discard can be dispatched even after meta is cleared.
    return buildWorkoutDiscardMutation({ localId, workoutId: serverId });
  }
  if (kind === 'workoutExercise.add') {
    return buildWorkoutExerciseRemoveMutation({
      localId,
      workoutLocalId: state.meta?.localId ?? '',
      serverId,
    });
  }
  if (kind === 'set.log') {
    return buildSetDeleteMutation({ localId, serverId });
  }
  return null;
}

// ---------- Per-mutation HTTP dispatch ----------

/**
 * Pure two-argument HTTP dispatcher.
 *
 * Accepts a DispatchableRequest produced by resolveRequest() — all server IDs must
 * already be embedded. Do not pass a raw QueuedMutation; call resolveRequest() first
 * so that local IDs are substituted and the correct URL is built.
 *
 * flushQueue() calls resolveRequest() then this function for every queued item.
 * External callers (tests, one-off scripts) follow the same two-step pattern:
 *   const req = resolveRequest(mutation, serverIds);
 *   if (req) await dispatchMutation(req, fetchImpl);
 */
export async function dispatchMutation(
  request: DispatchableRequest,
  fetchImpl: typeof fetch = fetch,
): Promise<MutationResult> {
  const { url, method, body, kind, clientMutationId } = request;

  try {
    const response = await fetchImpl(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': clientMutationId,
      },
      body: JSON.stringify(body),
    });

    const { status } = response;

    // 404 / 501: T7 not yet implemented — treat as retriable so T6 ships independently.
    if (status === 404 || status === 501) {
      return { ok: false, serverId: null, clientMutationId, retriable: true, status };
    }

    // 5xx: retriable server error
    if (status >= 500) {
      return { ok: false, serverId: null, clientMutationId, retriable: true, status };
    }

    // 400 / 422: validation error — unretriable, drop and quarantine
    if (status === 400 || status === 422) {
      return { ok: false, serverId: null, clientMutationId, retriable: false, status };
    }

    // Other 4xx (401, 403, 409, 429, ...): auth/rate-limit/conflict — retriable so
    // temporary session problems or rate limits do not permanently drop queued data.
    if (status >= 400) {
      return { ok: false, serverId: null, clientMutationId, retriable: true, status };
    }

    // 2xx success — create mutations must echo a valid id and matching clientMutationId
    if (isCreateKind(kind)) {
      let data: { id?: unknown; clientMutationId?: unknown };
      try {
        data = (await response.json()) as typeof data;
      } catch {
        log.warn('Failed to parse create response JSON', { kind, status });
        return { ok: false, serverId: null, clientMutationId, retriable: true, status };
      }

      // Require exact clientMutationId echo before linking IDs.
      if (data.clientMutationId !== clientMutationId) {
        log.warn('clientMutationId mismatch in create response', {
          expected: clientMutationId,
          got: data.clientMutationId,
        });
        return { ok: false, serverId: null, clientMutationId, retriable: true, status };
      }

      // Require a string id — a missing or non-string id means we cannot link dependents.
      if (typeof data.id !== 'string') {
        log.warn('Create response missing valid id', { kind, id: data.id });
        return { ok: false, serverId: null, clientMutationId, retriable: true, status };
      }

      return { ok: true, serverId: data.id, clientMutationId, retriable: false, status };
    }

    return { ok: true, serverId: null, clientMutationId, retriable: false, status };
  } catch (err) {
    // Network error — always retriable
    log.warn('Network error dispatching mutation', { kind, err });
    return { ok: false, serverId: null, clientMutationId, retriable: true, status: null };
  }
}

// ---------- Serial flush orchestrator ----------

export async function flushQueue(
  store: FlushableStore,
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  if (_flushInFlight) return;

  const initial = store.getState();
  if (!initial.sync.online || store.getQueue().length === 0) return;

  _flushInFlight = true;
  clearRetryTimer();
  store.setSyncState({ flushing: true, lastFlushError: null });

  try {
    outer: while (true) {
      const queue = store.getQueue();
      const head = queue[0];
      if (head === undefined) break;

      const state = store.getState();
      const serverIds = buildServerIdMap(state);

      // Dependency check: if any dependsOnLocalId has no resolved serverId, stop flush.
      for (const localId of head.dependsOnLocalIds) {
        if (serverIds[localId] === undefined) {
          break outer;
        }
      }

      // Resolve local IDs → server IDs and build the HTTP request.
      const dispatchable = resolveRequest(head, serverIds);
      if (dispatchable === null) {
        // dependsOnLocalIds check passed but resolveRequest still returned null — the
        // descriptor depends on an ID not listed in dependsOnLocalIds. Stop the flush
        // to avoid an infinite loop; this is a programming error in the descriptor builder.
        log.warn('resolveRequest returned null despite dependency check passing — stopping flush', {
          kind: head.kind,
          clientMutationId: head.clientMutationId,
        });
        break;
      }

      const result = await dispatchMutation(dispatchable, fetchImpl);

      if (result.ok) {
        if (isCreateKind(head.kind)) {
          // Safety guard: only drop create mutations after a valid server id has been
          // linked. dispatchMutation returns ok:false when id is missing, but guard here too.
          if (result.serverId === null) {
            log.warn('Create mutation succeeded but no serverId — treating as retriable', {
              kind: head.kind,
            });
            store.incrementAttempt(head.clientMutationId);
            scheduleRetry(store, fetchImpl, backoffMs(head.attempts + 1));
            break;
          }
          const localId = localIdForCreate(head);
          if (localId !== null) {
            store.applyServerIds({ [localId]: result.serverId });

            // Compensating delete: if the entity was optimistically removed while this
            // create was in flight, it won't exist in local state anymore. The server
            // record would otherwise be orphaned, and any queued mutations that depend on
            // the localId would block indefinitely. Enqueue a delete with the embedded
            // server ID so the queue can drain normally.
            const state = store.getState();
            if (!isEntityInState(state, localId, head.kind)) {
              const compensating = buildCompensatingDeleteMutation(
                head.kind,
                localId,
                result.serverId,
                state,
              );
              if (compensating !== null) {
                log.warn(
                  'Entity removed while create was in flight — enqueueing compensating delete',
                  {
                    kind: head.kind,
                    localId,
                    serverId: result.serverId,
                  },
                );
                store.enqueueMutation(compensating);
              }
            }
          }
        }
        // Clear the workout tombstone once the discard reaches the server so the
        // tombstones map does not accumulate stale entries across sessions.
        if (head.kind === 'workout.discard') {
          store.clearTombstone(head.payload.localId);
        }
        store.dropMutation(head.clientMutationId);
        // Continue loop — drain the next item
      } else if (result.retriable) {
        store.incrementAttempt(head.clientMutationId);
        const updatedAttempts = head.attempts + 1;
        const delay = backoffMs(updatedAttempts);
        log.warn('Retriable error, scheduling retry', {
          kind: head.kind,
          status: result.status,
          attempts: updatedAttempts,
          delayMs: delay,
        });
        store.setSyncState({
          lastFlushError: `HTTP ${result.status ?? 'network'} — retry in ${delay}ms`,
        });
        scheduleRetry(store, fetchImpl, delay);
        break;
      } else {
        // 4xx client error — quarantine and continue draining the rest of the queue
        log.error('Unretriable mutation error — quarantining', {
          kind: head.kind,
          clientMutationId: head.clientMutationId,
          status: result.status,
        });
        store.quarantineMutation(head.clientMutationId);
        // Do not break — attempt the next item
      }
    }
  } finally {
    _flushInFlight = false;
    store.setSyncState({ flushing: false, pendingCount: store.getQueue().length });
  }
}
