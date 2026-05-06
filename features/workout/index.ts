// ---------- Store hook ----------
export { useActiveWorkoutStore, clearCompletedSession } from './store/useActiveWorkoutStore';
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
  selectIsCompletedLocal,
  selectIsCompletedSynced,
  selectShouldAutoClear,
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
export { useCompletionCleanup } from './hooks/useCompletionCleanup';
export { useExerciseLookup } from './hooks/useExerciseLookup';
export type { ExerciseLookup } from './hooks/useExerciseLookup';

// ---------- Resume coordinator ----------
export { requestStartWorkout, subscribeResumeRequest, settleRequest } from './store/resumeCoordinator';
export type { StartDecision, StartIntent } from './store/resumeCoordinator';

// ---------- Lib ----------
export { DEFAULT_REST_SECONDS, restRemaining } from './lib/restTimer';
export { formatElapsed, formatRest, formatDuration, autoNameWorkout } from './lib/format';

// ---------- Components ----------
export { ResumeOrDiscardDialog } from './components/ResumeOrDiscardDialog';
export { ActiveWorkoutRuntime } from './components/ActiveWorkoutRuntime';
export { ActiveWorkoutHeader } from './components/ActiveWorkoutHeader';
export { ActiveWorkoutSession } from './components/ActiveWorkoutSession';
export { EndWorkoutSummary } from './components/EndWorkoutSummary';
export { ExerciseCard } from './components/ExerciseCard';
export { ExerciseCardList } from './components/ExerciseCardList';
export { RestTimer } from './components/RestTimer';
export { StartWorkoutEmptyState } from './components/StartWorkoutEmptyState';
export { TrainPageShell } from './components/TrainPageShell';
export { HistoryList } from './components/HistoryList';
export type { HistoryRowDTO } from './components/HistoryList';
export { WorkoutDetailView } from './components/WorkoutDetailView';
export type { WorkoutDetailDTO } from './components/WorkoutDetailView';
