import { Scale } from 'lucide-react';

import { cn } from '@/lib/utils';
import type { BmiCategory } from '@/lib/body-metrics/derive';

const SCALE_MIN = 15;
const SCALE_MAX = 35;
const TICKS = [15, 18.5, 25, 30, 35];

const PILL_BY_KEY: Record<BmiCategory['key'], string> = {
  underweight: 'bg-blue-500/15 text-blue-400',
  normal: 'bg-emerald-500/15 text-emerald-400',
  overweight: 'bg-amber-500/15 text-amber-400',
  obese: 'bg-red-500/15 text-red-400',
};

export interface BmiCardProps {
  bmi: number | null;
  category: BmiCategory | null;
  /** e.g. `5'10"` or `178 cm` */
  heightLabel: string | null;
  /** e.g. `186.4 lbs` or `84.5 kg` */
  weightLabel: string | null;
}

export function BmiCard({ bmi, category, heightLabel, weightLabel }: BmiCardProps) {
  const markerPct =
    bmi === null
      ? 0
      : Math.min(100, Math.max(0, ((bmi - SCALE_MIN) / (SCALE_MAX - SCALE_MIN)) * 100));

  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        <Scale className="h-4 w-4" />
        Body Mass Index
      </div>

      {bmi === null || category === null ? (
        <p className="mt-4 text-sm text-muted-foreground">
          Add your height in Personal info and log a weight to see your BMI.
        </p>
      ) : (
        <>
          <div className="mt-2 flex items-center gap-4">
            <span className="text-5xl font-bold leading-none tracking-tight">{bmi.toFixed(1)}</span>
            <span
              className={cn(
                'rounded-full px-3 py-1 text-sm font-semibold',
                PILL_BY_KEY[category.key],
              )}
            >
              {category.label}
            </span>
          </div>

          {heightLabel && weightLabel ? (
            <p className="mt-3 text-sm text-muted-foreground">
              Based on {heightLabel} · {weightLabel}
            </p>
          ) : null}

          <div className="mt-5">
            <div className="relative h-2 rounded-full bg-gradient-to-r from-blue-500 via-amber-500 via-emerald-500 to-red-500">
              <span
                className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-background bg-amber-400 shadow"
                style={{ left: `${markerPct}%` }}
                aria-hidden
              />
            </div>
            <div className="mt-2 flex justify-between text-xs text-muted-foreground">
              {TICKS.map((t) => (
                <span key={t}>{t}</span>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
