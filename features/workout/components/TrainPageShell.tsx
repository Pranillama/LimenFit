'use client';

import type * as React from 'react';

import { PageContainer } from '@/components/page-container';
import { PageSkeleton } from '@/components/page-skeleton';

import { selectActiveDraftMeta } from '../store/selectors';
import { useActiveWorkoutStore } from '../store/useActiveWorkoutStore';
import { ActiveWorkoutSession } from './ActiveWorkoutSession';
import { EndWorkoutSummary } from './EndWorkoutSummary';
import { StartWorkoutEmptyState } from './StartWorkoutEmptyState';

interface Props {
  insightsPanel?: React.ReactNode;
}

export function TrainPageShell({ insightsPanel }: Props) {
  const hydrated = useActiveWorkoutStore((s) => s.hydrated);
  const meta = useActiveWorkoutStore(selectActiveDraftMeta);

  if (!hydrated) {
    return (
      <PageContainer title="Train">
        <PageSkeleton />
      </PageContainer>
    );
  }

  if (meta === null) {
    return (
      <PageContainer title="Train">
        <StartWorkoutEmptyState insightsPanel={insightsPanel} />
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

  // completed_local | completed_synced — summary persists across refreshes until auto-cleared
  return (
    <PageContainer className="px-0 py-0 md:px-0 md:py-0">
      <EndWorkoutSummary onResume={() => {}} />
    </PageContainer>
  );
}
