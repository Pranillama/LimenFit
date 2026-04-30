// ---------- Store hook ----------
export { useActiveWorkoutStore } from './store/useActiveWorkoutStore';
export type {
  ActiveWorkoutStoreActions,
  ActiveWorkoutStoreState,
  LogSetInput,
  EditSetPatch,
  SyncResult,
  ServerWorkoutSnapshot,
} from './store/useActiveWorkoutStore';

// ---------- Selectors ----------
export {
  selectIsDirty,
  selectHasActiveDraft,
  selectActiveDraftMeta,
  selectPendingCount,
  selectSyncBadge,
  selectExerciseById,
  selectSyncState,
} from './store/selectors';

// ---------- Mutation builders ----------
export {
  buildWorkoutCreateMutation,
  buildWorkoutPatchMutation,
  buildWorkoutDiscardMutation,
  buildWorkoutRestoreMutation,
  buildWorkoutExerciseAddMutation,
  buildWorkoutExerciseRemoveMutation,
  buildWorkoutExerciseReorderMutation,
  buildSetLogMutation,
  buildSetEditMutation,
  buildSetDeleteMutation,
} from './store/mutationDescriptors';

// ---------- Types ----------
export type {
  ActiveWorkoutStatus,
  ActiveWorkoutMeta,
  ActiveSet,
  ActiveWorkoutExercise,
  RestTimerEntry,
  RestTimerState,
  PersistenceMode,
  SyncState,
  ActiveWorkoutState,
  ActiveWorkoutActions,
  WorkoutCreateMutation,
  WorkoutPatchMutation,
  WorkoutDiscardMutation,
  WorkoutRestoreMutation,
  WorkoutExerciseAddMutation,
  WorkoutExerciseRemoveMutation,
  WorkoutExerciseReorderMutation,
  SetLogMutation,
  SetEditMutation,
  SetDeleteMutation,
  QueuedMutation,
} from './store/types';

// ---------- Hooks ----------
export { useStartWorkoutAction } from './hooks/useStartWorkoutAction';
export type { StartWorkoutBlockedResult, StartWorkoutResult } from './hooks/useStartWorkoutAction';
export { useActiveWorkoutHydration } from './hooks/useActiveWorkoutHydration';

// ---------- Resume coordinator ----------
export { requestStartWorkout, subscribeResumeRequest, settleRequest } from './store/resumeCoordinator';
export type { StartDecision, StartIntent } from './store/resumeCoordinator';

// ---------- Components ----------
export { ResumeOrDiscardDialog } from './components/ResumeOrDiscardDialog';
export { ActiveWorkoutRuntime } from './components/ActiveWorkoutRuntime';
