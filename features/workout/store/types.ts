import type { Database } from '@/lib/supabase/types';

// Anchor primitive ID/field types to DB Row shapes so schema renames propagate
type WorkoutRow = Database['public']['Tables']['workouts']['Row'];
type WorkoutExerciseRow = Database['public']['Tables']['workout_exercises']['Row'];
type SetRow = Database['public']['Tables']['sets']['Row'];
type ExerciseRow = Database['public']['Tables']['exercises']['Row'];

type WeightUnit = Database['public']['Enums']['weight_unit'];
// DB enum — only used in mutation payloads sent to the server
type WorkoutStatus = Database['public']['Enums']['workout_status'];

// Local draft lifecycle — distinct from the DB workout_status enum
export type ActiveWorkoutStatus = 'idle' | 'in_progress' | 'completed_local' | 'completed_synced';

// ---------- Domain model ----------

export interface ActiveWorkoutMeta {
  workoutId: WorkoutRow['id'] | null; // null until the workout is synced to the server
  localId: string;
  name: WorkoutRow['name'];
  status: ActiveWorkoutStatus;
  startedAt: WorkoutRow['started_at'];
  lastActivityAt: WorkoutRow['last_activity_at'];
  planWorkoutId: WorkoutRow['plan_workout_id'];
  originPlanWorkoutId: string | null;
}

export interface ActiveSet {
  localId: string;
  serverId: SetRow['id'] | null;
  workoutExerciseLocalId: string;
  setNumber: SetRow['set_number'];
  reps: SetRow['reps'];
  weightValue: SetRow['weight_value'];
  weightUnit: SetRow['weight_unit'];
  loggedAt: SetRow['logged_at'];
  pending: boolean;
}

export interface ActiveWorkoutExercise {
  localId: string;
  serverId: WorkoutExerciseRow['id'] | null;
  exerciseId: ExerciseRow['id'];
  position: WorkoutExerciseRow['position'];
  sets: ActiveSet[];
  targetSets?: number;
  targetReps?: number;
  restSecondsOverride?: number;
}

// ---------- Preloaded exercise for startDraft ----------

export interface PreloadedExercise {
  exerciseId: string;
  targetSets?: number;
  targetReps?: number;
  restSecondsOverride?: number;
}

// ---------- Rest timer — keyed by exercise localId ----------

export interface RestTimerEntry {
  startedAt: string;
  durationSeconds: number;
  paused: boolean;
}

export type RestTimerState = Record<string, RestTimerEntry>;

// ---------- Deletion tombstones ----------

export type TombstoneEntityKind = 'workout' | 'workoutExercise' | 'set';

export interface DeletionTombstone {
  localId: string;
  entityKind: TombstoneEntityKind;
  /** True when a parent entity's server-side delete is already queued and will cascade to this child. */
  coveredByParentDelete: boolean;
}

/** localId → tombstone for entities deleted while an in-flight create may still be outstanding. */
export type TombstoneMap = Record<string, DeletionTombstone>;

// ---------- Sync state ----------

export type PersistenceMode = 'localStorage' | 'in-memory';

export interface SyncState {
  online: boolean;
  flushing: boolean;
  lastFlushError: string | null;
  pendingCount: number;
  persistenceMode: PersistenceMode;
}

// ---------- Queued mutation shared metadata ----------

interface QueuedMutationMeta {
  clientMutationId: string;
  enqueuedAt: string;
  attempts: number;
  dependsOnLocalIds: string[];
}

// ---------- Queued mutation union (kind-discriminated) ----------

export interface WorkoutCreateMutation extends QueuedMutationMeta {
  kind: 'workout.create';
  payload: {
    localId: string;
    name: WorkoutRow['name'];
    planWorkoutId: WorkoutRow['plan_workout_id'];
    originPlanWorkoutId: string | null;
    startedAt: WorkoutRow['started_at'];
    lastActivityAt: WorkoutRow['last_activity_at'];
  };
}

export interface WorkoutPatchMutation extends QueuedMutationMeta {
  kind: 'workout.patch';
  payload: {
    localId: string;
    name?: WorkoutRow['name'];
    status?: WorkoutStatus;
    lastActivityAt?: WorkoutRow['last_activity_at'];
  };
}

export interface WorkoutDiscardMutation extends QueuedMutationMeta {
  kind: 'workout.discard';
  payload: {
    localId: string;
    workoutId: string | null; // server ID known at discard time; null if not yet synced
  };
}

export interface WorkoutRestoreMutation extends QueuedMutationMeta {
  kind: 'workout.restore';
  payload: {
    localId: string;
  };
}

export interface WorkoutExerciseAddMutation extends QueuedMutationMeta {
  kind: 'workoutExercise.add';
  payload: {
    localId: string;
    workoutLocalId: string;
    exerciseId: ExerciseRow['id'];
    position: WorkoutExerciseRow['position'];
  };
}

export interface WorkoutExerciseRemoveMutation extends QueuedMutationMeta {
  kind: 'workoutExercise.remove';
  payload: {
    localId: string;
    workoutLocalId: string;
    serverId: string | null; // known at enqueue time when entity was already synced
  };
}

export interface WorkoutExerciseReorderMutation extends QueuedMutationMeta {
  kind: 'workoutExercise.reorder';
  payload: {
    localId: string;
    position: WorkoutExerciseRow['position'];
  };
}

export interface SetLogMutation extends QueuedMutationMeta {
  kind: 'set.log';
  payload: {
    localId: string;
    workoutExerciseLocalId: string;
    setNumber: SetRow['set_number'];
    reps: SetRow['reps'];
    weightValue: SetRow['weight_value'];
    weightUnit: SetRow['weight_unit'];
    loggedAt: SetRow['logged_at'];
  };
}

export interface SetEditMutation extends QueuedMutationMeta {
  kind: 'set.edit';
  payload: {
    localId: string;
    reps?: SetRow['reps'];
    weightValue?: SetRow['weight_value'];
    weightUnit?: SetRow['weight_unit'];
  };
}

export interface SetDeleteMutation extends QueuedMutationMeta {
  kind: 'set.delete';
  payload: {
    localId: string;
    serverId: string | null; // known at enqueue time when entity was already synced
  };
}

export type QueuedMutation =
  | WorkoutCreateMutation
  | WorkoutPatchMutation
  | WorkoutDiscardMutation
  | WorkoutRestoreMutation
  | WorkoutExerciseAddMutation
  | WorkoutExerciseRemoveMutation
  | WorkoutExerciseReorderMutation
  | SetLogMutation
  | SetEditMutation
  | SetDeleteMutation;

// ---------- Store state ----------

export interface ActiveWorkoutState {
  hydrated: boolean;
  meta: ActiveWorkoutMeta | null;
  exercises: ActiveWorkoutExercise[];
  restTimer: RestTimerState;
  sync: SyncState;
  queue: QueuedMutation[];
  quarantine: QueuedMutation[];
  tombstones: TombstoneMap;
}

// ---------- Store actions ----------

export interface ActiveWorkoutActions {
  setMeta: (meta: ActiveWorkoutMeta) => void;
  clearSession: () => void;
  addExercise: (exercise: ActiveWorkoutExercise) => void;
  removeExercise: (localId: string) => void;
  enqueue: (mutation: QueuedMutation) => void;
  acknowledgeIds: (ids: ReadonlySet<string>) => void;
  setSyncState: (patch: Partial<SyncState>) => void;
  setRestTimer: (exerciseLocalId: string, entry: RestTimerEntry | null) => void;
}
