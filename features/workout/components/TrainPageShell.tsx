'use client';

import { PageContainer } from '@/components/page-container';

import { selectActiveDraftMeta } from '../store/selectors';
import { useActiveWorkoutStore } from '../store/useActiveWorkoutStore';
import { ActiveWorkoutSession } from './ActiveWorkoutSession';
import { StartWorkoutEmptyState } from './StartWorkoutEmptyState';

export function TrainPageShell() {
  const meta = useActiveWorkoutStore(selectActiveDraftMeta);

  if (meta === null) {
    return (
      <PageContainer title="Train">
        <StartWorkoutEmptyState />
      </PageContainer>
    );
  }

  if (meta.status === 'in_progress') {
    return (
      <PageContainer className="max-w-none px-0 py-0 md:max-w-none md:px-0 md:py-0">
        <ActiveWorkoutSession />
      </PageContainer>
    );
  }

  // completed_local | completed_synced — wired in a later phase
  return (
    <PageContainer title="Train">
      <div data-testid="end-workout-summary" />
    </PageContainer>
  );
}
