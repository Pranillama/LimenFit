import type { InsightsBundle } from '../lib/types';
import { ConsistencyChart } from './ConsistencyChart';
import { InsightsEmptyCard } from './InsightsEmptyCard';
import { MuscleGroupVolumeChips } from './MuscleGroupVolumeChips';
import { VolumeTrendChart } from './VolumeTrendChart';

interface Props {
  bundle: InsightsBundle;
  completedWorkoutCount: number;
  unit?: 'lbs' | 'kg';
}

const MIN_WORKOUTS_FOR_CHARTS = 3;

export function InsightsPanel({ bundle, completedWorkoutCount, unit }: Props) {
  if (completedWorkoutCount < MIN_WORKOUTS_FOR_CHARTS) {
    return (
      <section className="space-y-6 pt-2">
        <h2 className="text-lg font-semibold">Your trends</h2>
        <InsightsEmptyCard />
      </section>
    );
  }

  const detectedUnit = bundle.oneRepMaxSeries[0]?.weightUnit ?? unit ?? 'lbs';

  return (
    <section className="space-y-6 pt-2">
      <h2 className="text-lg font-semibold">Your trends</h2>

      <div className="space-y-2">
        <h3 className="text-sm font-medium text-muted-foreground">Volume by muscle group</h3>
        <MuscleGroupVolumeChips data={bundle.volumeTrend} />
        <VolumeTrendChart
          data={bundle.volumeTrend}
          groupBy="muscleGroup"
          unit={detectedUnit}
        />
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-medium text-muted-foreground">Workout frequency</h3>
        <ConsistencyChart data={bundle.workoutsPerWeek} targetPerWeek={3} />
      </div>
    </section>
  );
}
