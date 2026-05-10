'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ExercisePicker } from '@/features/exercise-picker';
import { formatDuration } from '@/features/workout/lib/format';
import { selectActiveDraftMeta, selectSyncBadge } from '@/features/workout/store/selectors';
import { useActiveWorkoutStore } from '@/features/workout/store/useActiveWorkoutStore';

import type { HomeWorkoutSummary } from '../lib/homeDashboardDTO';

interface Props {
  todayCompletions: HomeWorkoutSummary[];
}

const startTimeFormat = new Intl.DateTimeFormat(undefined, {
  hour: 'numeric',
  minute: '2-digit',
});

export function TodaysWorkoutCard({ todayCompletions }: Props) {
  const router = useRouter();
  const hydrated = useActiveWorkoutStore((s) => s.hydrated);
  const meta = useActiveWorkoutStore(selectActiveDraftMeta);
  const syncBadge = useActiveWorkoutStore(selectSyncBadge);
  const [pickerOpen, setPickerOpen] = React.useState(false);

  function handlePickerConfirm(ids: string[]) {
    useActiveWorkoutStore.getState().startDraft({
      exercises: ids.map((id) => ({ exerciseId: id })),
    });
    router.push('/train');
  }

  if (!hydrated) {
    return <Skeleton className="h-[120px] w-full rounded-lg" />;
  }

  const isActiveDraft = meta?.status === 'in_progress';

  // Branch 1: Active draft
  if (isActiveDraft && meta) {
    const headingText = meta.name?.trim() || 'Workout in progress';
    const syncBadgeText =
      syncBadge === '●' ? 'Syncing…' : syncBadge !== null ? 'Sync pending' : null;

    return (
      <div className="rounded-lg border bg-card p-4">
        <div className="flex flex-col gap-3">
          <div>
            <h2 className="font-semibold">{headingText}</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Started at {startTimeFormat.format(new Date(meta.startedAt))}
            </p>
            {syncBadgeText !== null && (
              <span
                aria-live="polite"
                className="mt-1 inline-block rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
              >
                {syncBadgeText}
              </span>
            )}
          </div>
          <div className="flex flex-col gap-2 md:flex-row">
            <Button onClick={() => router.push('/train')}>Resume Workout</Button>
          </div>
        </div>
      </div>
    );
  }

  // Branch 2: Completed today
  const completedOnly = todayCompletions.filter((w) => w.status === 'completed');
  if (completedOnly.length > 0) {
    const recent = completedOnly[0]!;
    const durationLabel = recent.endedAt ? formatDuration(recent.startedAt, recent.endedAt) : '—';
    const { exerciseCount, setCount } = recent;

    return (
      <div className="rounded-lg border bg-card p-4">
        <div className="flex flex-col gap-3">
          <div>
            <h2 className="font-semibold">{recent.name}</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Completed today &middot; {durationLabel}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {exerciseCount} {exerciseCount === 1 ? 'exercise' : 'exercises'} &middot; {setCount}{' '}
              {setCount === 1 ? 'set' : 'sets'}
            </p>
          </div>
          <div className="flex flex-col gap-2 md:flex-row">
            <Button variant="outline" onClick={() => setPickerOpen(true)}>
              Start another workout
            </Button>
          </div>
        </div>
        <ExercisePicker
          open={pickerOpen}
          onOpenChange={setPickerOpen}
          onConfirm={handlePickerConfirm}
          title="Select Exercises"
        />
      </div>
    );
  }

  // Branch 3: Empty
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex flex-col gap-3">
        <p className="text-sm text-muted-foreground">No workout logged today</p>
        <div className="flex flex-col gap-2 md:flex-row">
          <Button onClick={() => setPickerOpen(true)}>Start Workout</Button>
        </div>
      </div>
      <ExercisePicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        onConfirm={handlePickerConfirm}
        title="Select Exercises"
      />
    </div>
  );
}
