import type { ActiveWorkoutExercise, ActiveWorkoutMeta, ActiveWorkoutState, SyncState, WeightUnit } from './types';

/**
 * True when any set is logged, any exercise has been added, or any user-entered
 * workout meta differs from the initial blank draft baseline (empty name, no plan
 * association). Drives DiscardConfirmationDialog; consumers should not read
 * exercises/sync directly.
 */
export function selectIsDirty(state: ActiveWorkoutState): boolean {
  const hasLoggedSets = state.exercises.some((ex) => ex.sets.length > 0);
  const hasExercises = state.exercises.length > 0;
  const meta = state.meta;
  const hasUserEnteredName = (meta?.name ?? '').trim().length > 0;
  const hasNonBlankMeta =
    meta !== null && (meta.planWorkoutId != null || meta.originPlanWorkoutId != null);
  return hasLoggedSets || hasExercises || hasUserEnteredName || hasNonBlankMeta;
}

/** True when there is an active draft workout in the store. */
export function selectHasActiveDraft(state: ActiveWorkoutState): boolean {
  return state.meta !== null;
}

/** Returns the active draft meta, or null when no workout is active. */
export function selectActiveDraftMeta(state: ActiveWorkoutState): ActiveWorkoutMeta | null {
  return state.meta;
}

/** Returns the number of mutations pending sync from the normalized SyncState. */
export function selectPendingCount(state: ActiveWorkoutState): number {
  return state.sync.pendingCount;
}

/**
 * Returns a badge string for sync UI: "●" while flushing, the pending count
 * as a string when >0, or null when there is nothing pending and sync is idle.
 */
export function selectSyncBadge(state: ActiveWorkoutState): string | null {
  if (state.sync.flushing) return '●';
  const count = state.sync.pendingCount;
  return count > 0 ? String(count) : null;
}

/** Returns a selector that finds the exercise with the given localId. */
export function selectExerciseById(
  localId: string,
): (state: ActiveWorkoutState) => ActiveWorkoutExercise | undefined {
  return (state) => state.exercises.find((ex) => ex.localId === localId);
}

/** Returns the current sync state. */
export function selectSyncState(state: ActiveWorkoutState): SyncState {
  return state.sync;
}

/** True when the workout has ended locally but the completed patch has not yet drained from the queue. */
export function selectIsCompletedLocal(state: ActiveWorkoutState): boolean {
  return state.meta?.status === 'completed_local';
}

/** True when the completed patch has been acknowledged by the server and the queue is empty. */
export function selectIsCompletedSynced(state: ActiveWorkoutState): boolean {
  return state.meta?.status === 'completed_synced';
}

/**
 * True when the session is safe to auto-clear: status is completed_synced,
 * the queue is fully drained, and no flush is in progress.
 */
export function selectShouldAutoClear(state: ActiveWorkoutState): boolean {
  return (
    state.meta?.status === 'completed_synced' &&
    state.queue.length === 0 &&
    !state.sync.flushing
  );
}

/** Returns the user's preferred weight unit from the settings slice. */
export function selectWeightUnit(state: ActiveWorkoutState): WeightUnit {
  return state.settings.weightUnit;
}

/** Returns the user's preferred rest timer duration in seconds from the settings slice. */
export function selectRestTimerDefaultSeconds(state: ActiveWorkoutState): number {
  return state.settings.restTimerDefaultSeconds;
}
