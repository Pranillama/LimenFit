import Link from 'next/link';

import { Button } from '@/components/ui/button';

import type { PublicPlanDTO } from '../lib/publicPlanDTO';
import { DuplicatePlanButton } from './DuplicatePlanButton';

interface PublicPlanViewerProps {
  plan: PublicPlanDTO;
  viewerIsLoggedIn: boolean;
}

function CtaBanner() {
  return (
    <div className="flex flex-col items-start gap-3 rounded-lg border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm">Track this workout with LimenFit — Sign up free</p>
      <Button asChild size="sm">
        <Link href="/auth">Sign up free</Link>
      </Button>
    </div>
  );
}

function formatUpdatedAt(updatedAt: string): string {
  const date = new Date(updatedAt);
  if (Number.isNaN(date.getTime())) return updatedAt;
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function PublicPlanViewer({ plan, viewerIsLoggedIn }: PublicPlanViewerProps) {
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">{plan.name}</h1>
        <p className="text-xs text-muted-foreground">Updated {formatUpdatedAt(plan.updatedAt)}</p>
      </header>

      <div className="flex flex-col gap-3">
        <CtaBanner />
        <DuplicatePlanButton shareSlug={plan.shareSlug} viewerIsLoggedIn={viewerIsLoggedIn} />
      </div>

      <div className="flex flex-col gap-4">
        {plan.workouts.map((workout, index) => (
          <details key={workout.id} open={index === 0} className="rounded-lg border bg-card p-4">
            <summary className="cursor-pointer font-medium">{workout.name}</summary>
            <div className="mt-3">
              {workout.exercises.length > 0 ? (
                <ul className="space-y-1">
                  {workout.exercises.map((ex) => (
                    <li key={ex.id} className="flex items-center justify-between text-sm">
                      <span>{ex.exerciseName}</span>
                      <span className="text-muted-foreground">
                        Target: {ex.targetSets} × {ex.targetReps}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">No exercises added.</p>
              )}
            </div>
          </details>
        ))}

        {plan.workouts.length === 0 && (
          <p className="py-4 text-center text-sm text-muted-foreground">
            No workouts in this plan yet.
          </p>
        )}
      </div>

      <CtaBanner />
    </div>
  );
}
