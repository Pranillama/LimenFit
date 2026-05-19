'use client';

import { useRouter } from 'next/navigation';
import { toast } from '@/components/ui/sonner';
import { useActiveWorkoutStore } from '../store/useActiveWorkoutStore';
import { requestStartWorkout, type StartIntent } from '../store/resumeCoordinator';
import { selectHasActiveDraft, selectIsCompletedLocalProtected } from '../store/selectors';

const SYNC_IN_PROGRESS_MSG =
  'Workout is still syncing. Please wait before starting another workout.';

export type StartWorkoutBlockedResult =
  | { blocked: true; reason: 'active-draft-exists' }
  | { blocked: true; reason: 'sync-in-progress' };
export type StartWorkoutResult = void | StartWorkoutBlockedResult;

/**
 * Returns an async action that T10 (history Repeat), T12 (plan Start), and
 * T14 (home Start Workout) call to begin or continue a workout session.
 *
 * For 'history-restore' intents (restoring an expired draft from T10/T7),
 * the action short-circuits: if a draft is active it returns blocked; if not,
 * it hydrates the store from the provided snapshot and navigates directly to
 * /train without going through the resume dialog.
 */
export function useStartWorkoutAction() {
  const router = useRouter();

  return async function startWorkout(intent: StartIntent): Promise<StartWorkoutResult> {
    // history-restore is handled entirely here — the resume dialog is not involved.
    if (intent.source === 'history-restore') {
      if (selectHasActiveDraft(useActiveWorkoutStore.getState())) {
        return { blocked: true, reason: 'active-draft-exists' };
      }
      if (selectIsCompletedLocalProtected(useActiveWorkoutStore.getState())) {
        return { blocked: true, reason: 'sync-in-progress' };
      }
      useActiveWorkoutStore.getState().hydrateFromServer(intent.payload.snapshot);
      router.push('/train');
      return;
    }

    const decision = await requestStartWorkout(intent);

    switch (decision) {
      case 'resume':
        router.push('/train');
        break;

      case 'discard-and-start': {
        const state = useActiveWorkoutStore.getState();
        const status = state.meta?.status;
        if (status === 'completed_local' || status === 'completed_synced') {
          state.clearCompletedSession();
        } else {
          state.discardDraft();
        }
        if (intent.source === 'plan') {
          state.startDraft({
            planWorkoutId: intent.payload.planWorkoutId,
            name: intent.payload.planWorkoutName,
            exercises: intent.payload.exercises,
          });
        } else if (intent.source === 'history') {
          state.startDraft({ exercises: intent.payload?.exercises });
        } else {
          state.startDraft();
        }
        router.push('/train');
        break;
      }

      case 'sync-in-progress':
        toast.error(SYNC_IN_PROGRESS_MSG);
        return { blocked: true, reason: 'sync-in-progress' };

      case 'cancel':
        // User dismissed — no-op.
        break;
    }
  };
}
