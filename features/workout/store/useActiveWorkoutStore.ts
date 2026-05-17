'use client';

import { createJSONStorage } from 'zustand/middleware';
import { toast } from '@/components/ui/sonner';
import { createAppStore, type PersistConfig } from '@/stores/createStore';
import {
  buildWorkoutCreateMutation,
  buildWorkoutPatchMutation,
  buildWorkoutDiscardMutation,
  buildWorkoutExerciseAddMutation,
  buildWorkoutExerciseRemoveMutation,
  buildWorkoutExerciseReorderMutation,
  buildSetLogMutation,
  buildSetEditMutation,
  buildSetDeleteMutation,
} from './mutationDescriptors';
import { createSafeStorage, subscribeDegrade } from './persistence';
import type {
  ActiveWorkoutState,
  ActiveWorkoutMeta,
  ActiveWorkoutExercise,
  ActiveSet,
  SyncState,
  PersistenceMode,
  QueuedMutation,
  RestTimerState,
  TombstoneMap,
  PreloadedExercise,
  UserSettings,
} from './types';
import type { Database } from '@/lib/supabase/types';

// ---------- Constants ----------

const MAX_QUARANTINE_SIZE = 50;

// ---------- Helper ----------

function newLocalId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// ---------- Action input types ----------

type WeightUnit = Database['public']['Enums']['weight_unit'];

// Matches the DB column defaults in the settings table migration.
const INITIAL_SETTINGS: UserSettings = {
  weightUnit: 'lbs',
  restTimerDefaultSeconds: 90,
};

export interface LogSetInput {
  weight: number; // public field; translated to weightValue internally
  reps: number;
  weightUnit: WeightUnit;
}

export interface EditSetPatch {
  weight?: number; // public field; translated to weightValue internally
  reps?: number;
  weightUnit?: WeightUnit;
}

export interface SyncResult {
  /** clientMutationIds that the server successfully applied */
  flushed: string[];
  error: string | null;
}

// ---------- Store type ----------

export interface ServerWorkoutSnapshot {
  meta: ActiveWorkoutMeta;
  exercises: ActiveWorkoutExercise[];
}

export interface ActiveWorkoutStoreActions {
  markHydrated(): void;
  setUserSettings(patch: Partial<UserSettings>): void;
  resetStore(): void;
  startDraft(params?: {
    planWorkoutId?: string | null;
    name?: string;
    exercises?: PreloadedExercise[];
  }): void;
  addExercises(exerciseIds: string[]): void;
  removeExercise(localId: string): void;
  reorderExercises(orderedLocalIds: string[]): void;
  logSet(exerciseLocalId: string, input: LogSetInput): void;
  editSet(setLocalId: string, patch: EditSetPatch): void;
  deleteSet(setLocalId: string): void;
  renameWorkout(name: string): void;
  endWorkout(params?: { name?: string }): void;
  discardDraft(): void;
  hydrateFromServer(snapshot: ServerWorkoutSnapshot): void;
  markOnline(online: boolean): void;
  recordSyncResult(result: SyncResult): void;
  applyServerIds(localToServerMap: Record<string, string>): void;
  setPersistenceMode(mode: PersistenceMode): void;
  clearCompletedSession(): void;
  setRestTimer(exerciseLocalId: string, entry: import('./types').RestTimerEntry | null): void; // client-only; not queued
  // Flush-engine surface
  getQueue(): QueuedMutation[];
  getTombstones(): TombstoneMap;
  clearTombstone(localId: string): void;
  setSyncState(patch: Partial<SyncState>): void;
  dropMutation(clientMutationId: string): void;
  incrementAttempt(clientMutationId: string): void;
  quarantineMutation(clientMutationId: string): void;
  enqueueMutation(mutation: QueuedMutation): void;
}

export type ActiveWorkoutStoreState = ActiveWorkoutState & ActiveWorkoutStoreActions;

// ---------- Initial state ----------

const initialSync: SyncState = {
  online: true,
  flushing: false,
  lastFlushError: null,
  pendingCount: 0,
  persistenceMode: 'localStorage',
};

const INITIAL_STATE: ActiveWorkoutState = {
  hydrated: false,
  settings: INITIAL_SETTINGS,
  meta: null,
  exercises: [],
  restTimer: {},
  sync: initialSync,
  queue: [],
  quarantine: [],
  tombstones: {},
};

// ---------- Persisted slice type ----------
// Mirrors ActiveWorkoutState minus transient sync fields; restTimer only keeps paused entries.
type PersistedSlice = Omit<ActiveWorkoutState, 'sync' | 'restTimer' | 'hydrated'> & {
  sync: Pick<SyncState, 'online' | 'pendingCount' | 'persistenceMode'>;
  restTimer: RestTimerState; // only paused entries are written; running timers are excluded
  settings: UserSettings;
  // quarantine is included so 4xx-dropped mutations survive reload (debug only)
};

// ---------- Persist config ----------

const persistConfig: PersistConfig<ActiveWorkoutStoreState, PersistedSlice> = {
  name: 'limenfit:active-workout:v1',
  version: 1,
  storage: createJSONStorage(() => createSafeStorage()),
  partialize: (state): PersistedSlice => ({
    settings: state.settings,
    meta: state.meta,
    exercises: state.exercises,
    // Exclude running timers — their startedAt becomes stale across reloads.
    restTimer: Object.fromEntries(
      Object.entries(state.restTimer).filter(([, entry]) => entry.paused),
    ),
    queue: state.queue,
    quarantine: state.quarantine,
    tombstones: state.tombstones,
    sync: {
      online: state.sync.online,
      pendingCount: state.sync.pendingCount,
      persistenceMode: state.sync.persistenceMode,
    },
  }),
  // Deep-merge so transient SyncState fields are always initialised from INITIAL_STATE,
  // never left undefined after hydration.
  merge: (persisted, current) => {
    const p = persisted as PersistedSlice;
    const hydratedQueue = p.queue ?? [];
    return {
      ...current,
      settings: p.settings ?? INITIAL_SETTINGS,
      meta: p.meta ?? null,
      exercises: p.exercises ?? [],
      restTimer: p.restTimer ?? {},
      queue: hydratedQueue,
      quarantine: (p.quarantine ?? []).slice(-MAX_QUARANTINE_SIZE),
      tombstones: p.tombstones ?? {},
      sync: {
        ...initialSync,
        online: p.sync?.online ?? initialSync.online,
        persistenceMode: p.sync?.persistenceMode ?? initialSync.persistenceMode,
        // Derive count from the actual queue so it is never stale.
        pendingCount: hydratedQueue.length,
      },
    };
  },
};

// ---------- Store ----------

export const useActiveWorkoutStore = createAppStore<ActiveWorkoutStoreState, PersistedSlice>(
  (set, get) => ({
    ...INITIAL_STATE,

    markHydrated() {
      set((s) => ({ ...s, hydrated: true }));
    },

    setUserSettings(patch) {
      set((s) => ({ ...s, settings: { ...s.settings, ...patch } }));
    },

    resetStore() {
      set({ ...INITIAL_STATE, hydrated: true });
    },

    startDraft({ planWorkoutId, name: initialName, exercises: preloadedExercises = [] } = {}) {
      const localId = newLocalId();
      const now = new Date().toISOString();
      const resolvedPlanId = planWorkoutId ?? null;
      const resolvedName = initialName ?? '';

      const meta: ActiveWorkoutMeta = {
        workoutId: null,
        localId,
        name: resolvedName,
        status: 'in_progress',
        startedAt: now,
        lastActivityAt: now,
        planWorkoutId: resolvedPlanId,
        originPlanWorkoutId: resolvedPlanId,
      };

      const createMutation = buildWorkoutCreateMutation({
        localId,
        name: resolvedName,
        planWorkoutId: resolvedPlanId,
        originPlanWorkoutId: resolvedPlanId,
        startedAt: now,
        lastActivityAt: now,
      });

      const exercises: ActiveWorkoutExercise[] = preloadedExercises.map((ex, i) => ({
        localId: newLocalId(),
        serverId: null,
        exerciseId: ex.exerciseId,
        position: i,
        sets: [],
        targetSets: ex.targetSets,
        targetReps: ex.targetReps,
        restSecondsOverride: ex.restSecondsOverride,
      }));

      const exerciseMutations: QueuedMutation[] = exercises.map((ex) =>
        buildWorkoutExerciseAddMutation({
          localId: ex.localId,
          workoutLocalId: localId,
          exerciseId: ex.exerciseId,
          position: ex.position,
        }),
      );

      set((s) => {
        const queue = [...s.queue, createMutation, ...exerciseMutations];
        return {
          ...s,
          meta,
          exercises,
          restTimer: {},
          queue,
          sync: { ...s.sync, pendingCount: queue.length },
        };
      });
    },

    addExercises(exerciseIds) {
      set((s) => {
        if (!s.meta) return s;
        const now = new Date().toISOString();
        const maxPosition = s.exercises.reduce((max, ex) => Math.max(max, ex.position), -1);

        const newExercises: ActiveWorkoutExercise[] = exerciseIds.map((exerciseId, i) => ({
          localId: newLocalId(),
          serverId: null,
          exerciseId,
          position: maxPosition + 1 + i,
          sets: [],
        }));

        const mutations: QueuedMutation[] = newExercises.map((ex) =>
          buildWorkoutExerciseAddMutation({
            localId: ex.localId,
            workoutLocalId: s.meta!.localId,
            exerciseId: ex.exerciseId,
            position: ex.position,
          }),
        );

        const queue = [...s.queue, ...mutations];
        return {
          ...s,
          exercises: [...s.exercises, ...newExercises],
          queue,
          sync: { ...s.sync, pendingCount: queue.length },
          meta: { ...s.meta, lastActivityAt: now },
        };
      });
    },

    removeExercise(localId) {
      set((s) => {
        if (!s.meta) return s;
        const now = new Date().toISOString();
        const exercise = s.exercises.find((ex) => ex.localId === localId);
        if (!exercise) return s;

        const setLocalIds = new Set(exercise.sets.map((set) => set.localId));

        // Record tombstones before removing from live state so that in-flight creates
        // that complete after this point can detect the deletion and act accordingly.
        // Child sets are covered by the parent exercise delete when the exercise was
        // already synced (its removal will cascade on the server).
        const childSetsCoveredByParent = exercise.serverId !== null;
        const newTombstones: TombstoneMap = { ...s.tombstones };
        newTombstones[localId] = {
          localId,
          entityKind: 'workoutExercise',
          coveredByParentDelete: false,
        };
        for (const set of exercise.sets) {
          newTombstones[set.localId] = {
            localId: set.localId,
            entityKind: 'set',
            coveredByParentDelete: childSetsCoveredByParent,
          };
        }

        // Always coalesce stale queued mutations for this exercise and its child sets,
        // regardless of sync state. Earlier reorders or set edits would block the queue
        // because their dependsOnLocalIds can no longer resolve once the entity is gone.
        const filtered = s.queue.filter((m) => {
          if (
            (m.kind === 'workoutExercise.add' ||
              m.kind === 'workoutExercise.reorder' ||
              m.kind === 'workoutExercise.remove') &&
            m.payload.localId === localId
          )
            return false;
          if (
            (m.kind === 'set.log' || m.kind === 'set.edit' || m.kind === 'set.delete') &&
            setLocalIds.has(m.payload.localId)
          )
            return false;
          return true;
        });

        // Only append a server delete when the exercise was already synced. If it was
        // never synced, the coalesced queue is sufficient — no server record exists.
        const queue =
          exercise.serverId !== null
            ? [
                ...filtered,
                buildWorkoutExerciseRemoveMutation({
                  localId,
                  workoutLocalId: s.meta.localId,
                  serverId: exercise.serverId,
                }),
              ]
            : filtered;

        return {
          ...s,
          exercises: s.exercises.filter((ex) => ex.localId !== localId),
          tombstones: newTombstones,
          queue,
          sync: { ...s.sync, pendingCount: queue.length },
          meta: { ...s.meta, lastActivityAt: now },
        };
      });
    },

    reorderExercises(orderedLocalIds) {
      set((s) => {
        if (!s.meta) return s;
        const now = new Date().toISOString();
        const byLocalId = new Map(s.exercises.map((ex) => [ex.localId, ex]));

        // Build reordered array; exercises not in the provided list are appended as-is
        const ordered: ActiveWorkoutExercise[] = [];
        orderedLocalIds.forEach((id, i) => {
          const ex = byLocalId.get(id);
          if (ex) ordered.push({ ...ex, position: i });
        });
        // Append any exercises that were not mentioned (defensive)
        s.exercises.forEach((ex) => {
          if (!orderedLocalIds.includes(ex.localId)) {
            ordered.push({ ...ex, position: ordered.length });
          }
        });

        const mutations: QueuedMutation[] = ordered.map((ex) =>
          buildWorkoutExerciseReorderMutation({ localId: ex.localId, position: ex.position }),
        );

        const queue = [...s.queue, ...mutations];
        return {
          ...s,
          exercises: ordered,
          queue,
          sync: { ...s.sync, pendingCount: queue.length },
          meta: { ...s.meta, lastActivityAt: now },
        };
      });
    },

    logSet(exerciseLocalId, { weight, reps, weightUnit }) {
      set((s) => {
        if (!s.meta) return s;
        const exercise = s.exercises.find((ex) => ex.localId === exerciseLocalId);
        if (!exercise) return s;

        const now = new Date().toISOString();
        const setNumber = exercise.sets.length + 1;
        const setLocalId = newLocalId();

        const newSet: ActiveSet = {
          localId: setLocalId,
          serverId: null,
          workoutExerciseLocalId: exerciseLocalId,
          setNumber,
          reps,
          weightValue: weight,
          weightUnit,
          loggedAt: now,
          pending: true,
        };

        const mutation = buildSetLogMutation({
          localId: setLocalId,
          workoutExerciseLocalId: exerciseLocalId,
          setNumber,
          reps,
          weightValue: weight,
          weightUnit,
          loggedAt: now,
        });

        const exercises = s.exercises.map((ex) =>
          ex.localId === exerciseLocalId ? { ...ex, sets: [...ex.sets, newSet] } : ex,
        );

        const queue = [...s.queue, mutation];
        return {
          ...s,
          exercises,
          queue,
          sync: { ...s.sync, pendingCount: queue.length },
          meta: { ...s.meta, lastActivityAt: now },
        };
      });
    },

    editSet(setLocalId, { weight, ...rest }) {
      set((s) => {
        if (!s.meta) return s;
        const now = new Date().toISOString();
        // Translate public field to internal model field.
        const internalPatch = { ...rest, ...(weight !== undefined ? { weightValue: weight } : {}) };

        const exercises = s.exercises.map((ex) => ({
          ...ex,
          sets: ex.sets.map((set) =>
            set.localId === setLocalId ? { ...set, ...internalPatch } : set,
          ),
        }));

        const mutation = buildSetEditMutation({ localId: setLocalId, ...internalPatch });
        const queue = [...s.queue, mutation];
        return {
          ...s,
          exercises,
          queue,
          sync: { ...s.sync, pendingCount: queue.length },
          meta: { ...s.meta, lastActivityAt: now },
        };
      });
    },

    deleteSet(setLocalId) {
      set((s) => {
        if (!s.meta) return s;
        const now = new Date().toISOString();

        // Confirm the set exists and capture its server ID before removal.
        let foundSet: ActiveSet | undefined;
        for (const ex of s.exercises) {
          foundSet = ex.sets.find((set) => set.localId === setLocalId);
          if (foundSet) break;
        }
        if (!foundSet) return s;

        const foundServerId = foundSet.serverId;

        // Record tombstone before removing from live state so that an in-flight set.log
        // that completes after this point can detect the deletion and enqueue a compensating
        // delete (not covered by a parent, so coveredByParentDelete is false).
        const newTombstones: TombstoneMap = {
          ...s.tombstones,
          [setLocalId]: { localId: setLocalId, entityKind: 'set', coveredByParentDelete: false },
        };

        // Always coalesce stale queued mutations for this set first. A prior set.edit or
        // set.delete ahead of the new delete would either duplicate work or block the queue
        // because its dependsOnLocalIds can no longer resolve once the entity is gone.
        const filtered = s.queue.filter(
          (m) =>
            !(
              (m.kind === 'set.log' || m.kind === 'set.edit' || m.kind === 'set.delete') &&
              m.payload.localId === setLocalId
            ),
        );

        const exercises = s.exercises.map((ex) => ({
          ...ex,
          sets: ex.sets.filter((set) => set.localId !== setLocalId),
        }));

        // Only append a server delete when the set was already synced.
        const queue =
          foundServerId !== null
            ? [
                ...filtered,
                buildSetDeleteMutation({ localId: setLocalId, serverId: foundServerId }),
              ]
            : filtered;

        return {
          ...s,
          exercises,
          tombstones: newTombstones,
          queue,
          sync: { ...s.sync, pendingCount: queue.length },
          meta: { ...s.meta, lastActivityAt: now },
        };
      });
    },

    renameWorkout(name) {
      set((s) => {
        if (!s.meta) return s;
        const now = new Date().toISOString();
        const mutation = buildWorkoutPatchMutation({
          localId: s.meta.localId,
          name,
          lastActivityAt: now,
        });
        const queue = [...s.queue, mutation];
        return {
          ...s,
          meta: { ...s.meta, name, lastActivityAt: now },
          queue,
          sync: { ...s.sync, pendingCount: queue.length },
        };
      });
    },

    endWorkout({ name } = {}) {
      set((s) => {
        if (!s.meta) return s;
        const now = new Date().toISOString();
        const resolvedName = name ?? s.meta.name;

        const mutation = buildWorkoutPatchMutation({
          localId: s.meta.localId,
          status: 'completed',
          ...(name !== undefined ? { name } : {}),
          lastActivityAt: now,
        });

        const queue = [...s.queue, mutation];
        return {
          ...s,
          meta: { ...s.meta, name: resolvedName, status: 'completed_local', lastActivityAt: now },
          queue,
          sync: { ...s.sync, pendingCount: queue.length },
        };
      });
    },

    discardDraft() {
      set((s) => {
        if (!s.meta) return s;
        const hasServerId = s.meta.workoutId !== null;
        const workoutLocalId = s.meta.localId;

        if (hasServerId) {
          // Server already knows about this workout — enqueue a discard mutation that carries
          // the server workoutId so the sync engine can resolve it even after meta is cleared.
          // The workout.discard cascades child records server-side, so tombstone all exercises
          // and sets as covered by this parent deletion.
          const newTombstones: TombstoneMap = {};
          for (const ex of s.exercises) {
            newTombstones[ex.localId] = {
              localId: ex.localId,
              entityKind: 'workoutExercise',
              coveredByParentDelete: true,
            };
            for (const set of ex.sets) {
              newTombstones[set.localId] = {
                localId: set.localId,
                entityKind: 'set',
                coveredByParentDelete: true,
              };
            }
          }

          const mutation = buildWorkoutDiscardMutation({
            localId: workoutLocalId,
            workoutId: s.meta.workoutId,
          });
          return {
            ...INITIAL_STATE,
            hydrated: s.hydrated,
            settings: s.settings,
            tombstones: newTombstones,
            queue: [mutation],
            sync: {
              ...initialSync,
              online: s.sync.online,
              persistenceMode: s.sync.persistenceMode,
              pendingCount: 1,
            },
          };
        }

        // No server-side record yet — workout.create may be in-flight. Tombstone the
        // workout localId so that if the create succeeds, the queue engine can detect
        // the discard and immediately send a server-side workout.discard.
        const newTombstones: TombstoneMap = {
          [workoutLocalId]: {
            localId: workoutLocalId,
            entityKind: 'workout',
            coveredByParentDelete: false,
          },
        };

        return {
          ...INITIAL_STATE,
          hydrated: s.hydrated,
          settings: s.settings,
          tombstones: newTombstones,
          sync: {
            ...initialSync,
            online: s.sync.online,
            persistenceMode: s.sync.persistenceMode,
          },
        };
      });
    },

    hydrateFromServer(snapshot) {
      set((s) => ({
        ...s,
        meta: snapshot.meta,
        exercises: snapshot.exercises,
        queue: [],
        quarantine: [],
        tombstones: {},
        restTimer: {},
        sync: {
          ...initialSync,
          online: s.sync.online,
          persistenceMode: s.sync.persistenceMode,
          pendingCount: 0,
        },
      }));
    },

    markOnline(online) {
      set((s) => ({ ...s, sync: { ...s.sync, online } }));
    },

    recordSyncResult({ flushed, error }) {
      set((s) => {
        const flushedSet = new Set(flushed);
        const queue = s.queue.filter((m) => !flushedSet.has(m.clientMutationId));
        const meta =
          s.meta?.status === 'completed_local' && queue.length === 0 && error === null
            ? { ...s.meta, status: 'completed_synced' as const }
            : s.meta;
        return {
          ...s,
          meta,
          queue,
          sync: {
            ...s.sync,
            flushing: false,
            lastFlushError: error,
            pendingCount: queue.length,
          },
        };
      });
    },

    clearCompletedSession() {
      set((s) => {
        const status = s.meta?.status;
        if (status !== 'completed_local' && status !== 'completed_synced') return s;
        return {
          ...INITIAL_STATE,
          hydrated: s.hydrated,
          settings: s.settings,
          sync: {
            ...initialSync,
            online: s.sync.online,
            persistenceMode: s.sync.persistenceMode,
          },
        };
      });
    },

    applyServerIds(localToServerMap) {
      set((s) => {
        const meta = s.meta
          ? {
              ...s.meta,
              workoutId: localToServerMap[s.meta.localId] ?? s.meta.workoutId,
            }
          : null;

        const exercises = s.exercises.map((ex) => ({
          ...ex,
          serverId: localToServerMap[ex.localId] ?? ex.serverId,
          sets: ex.sets.map((set) => ({
            ...set,
            serverId: localToServerMap[set.localId] ?? set.serverId,
          })),
        }));

        return { ...s, meta, exercises };
      });
    },

    setPersistenceMode(mode) {
      set((s) => ({ ...s, sync: { ...s.sync, persistenceMode: mode } }));
    },

    setSyncState(patch) {
      set((s) => ({ ...s, sync: { ...s.sync, ...patch } }));
    },

    dropMutation(clientMutationId) {
      set((s) => {
        const dropping = s.queue.find((m) => m.clientMutationId === clientMutationId);
        const queue = s.queue.filter((m) => m.clientMutationId !== clientMutationId);
        const isCompletedPatch =
          dropping?.kind === 'workout.patch' && dropping.payload.status === 'completed';
        const meta =
          isCompletedPatch && queue.length === 0 && s.meta?.status === 'completed_local'
            ? { ...s.meta, status: 'completed_synced' as const }
            : s.meta;
        return { ...s, meta, queue, sync: { ...s.sync, pendingCount: queue.length } };
      });
    },

    incrementAttempt(clientMutationId) {
      set((s) => ({
        ...s,
        queue: s.queue.map((m) =>
          m.clientMutationId === clientMutationId ? { ...m, attempts: m.attempts + 1 } : m,
        ),
      }));
    },

    quarantineMutation(clientMutationId) {
      set((s) => {
        const mutation = s.queue.find((m) => m.clientMutationId === clientMutationId);
        const queue = s.queue.filter((m) => m.clientMutationId !== clientMutationId);
        const appended = mutation ? [...s.quarantine, mutation] : s.quarantine;
        const quarantine =
          appended.length > MAX_QUARANTINE_SIZE
            ? appended.slice(appended.length - MAX_QUARANTINE_SIZE)
            : appended;
        return {
          ...s,
          queue,
          quarantine,
          sync: { ...s.sync, pendingCount: queue.length },
        };
      });
    },

    getQueue() {
      return get().queue;
    },

    getTombstones() {
      return get().tombstones;
    },

    clearTombstone(localId) {
      set((s) => {
        const { [localId]: _, ...rest } = s.tombstones;
        return { ...s, tombstones: rest };
      });
    },

    enqueueMutation(mutation) {
      set((s) => {
        const queue = [...s.queue, mutation];
        return { ...s, queue, sync: { ...s.sync, pendingCount: queue.length } };
      });
    },

    setRestTimer(exerciseLocalId, entry) {
      set((s) => {
        if (entry === null) {
          const { [exerciseLocalId]: _, ...rest } = s.restTimer;
          return { ...s, restTimer: rest };
        }
        return { ...s, restTimer: { ...s.restTimer, [exerciseLocalId]: entry } };
      });
    },
  }),
  persistConfig,
);

// Wire persistence degradation: switch mode + show a sticky toast (once, deduplicated by ID).
subscribeDegrade(() => {
  useActiveWorkoutStore.getState().setPersistenceMode('in-memory');
  toast.warning('Offline persistence unavailable; avoid refresh.', {
    duration: Infinity,
    id: 'persistence-degraded',
  });
});

/** Standalone wrapper so consumers can import clearCompletedSession directly from this module. */
export function clearCompletedSession(): void {
  useActiveWorkoutStore.getState().clearCompletedSession();
}

/** Standalone wrapper — resets all store state to initial values, preserving hydrated: true. */
export function resetStore(): void {
  useActiveWorkoutStore.getState().resetStore();
}
