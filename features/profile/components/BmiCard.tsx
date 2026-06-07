import { Check, Flame, HeartPulse, Info } from 'lucide-react';

import { cn } from '@/lib/utils';
import { bmiRangeLabel, type BmiCategory, type BmiCategoryKey } from '@/lib/body-metrics/derive';

import { BmiGauge } from './BmiGauge';

const TEXT_BY_KEY: Record<BmiCategoryKey, string> = {
  underweight: 'text-blue-400',
  normal: 'text-emerald-400',
  overweight: 'text-amber-400',
  obese: 'text-red-400',
};

const CALLOUT_BY_KEY: Record<BmiCategoryKey, string> = {
  underweight: 'border-blue-500/30 bg-blue-500/10 text-blue-300',
  normal: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
  overweight: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
  obese: 'border-red-500/30 bg-red-500/10 text-red-300',
};

const CALLOUT_MESSAGE: Record<BmiCategoryKey, string> = {
  underweight: "You're below the healthy range.",
  normal: "Great! You're in the healthy range.",
  overweight: "You're above the healthy range.",
  obese: 'Above the healthy range — small steps add up.',
};

export interface BmiCardProps {
  bmi: number | null;
  category: BmiCategory | null;
  /** e.g. `Male` / `Female` */
  sexLabel: string | null;
  age: number | null;
  /** e.g. `5'10"` or `178 cm` */
  heightLabel: string | null;
  /** e.g. `186.4 lbs` or `84.5 kg` */
  weightLabel: string | null;
  /** e.g. `58.5 – 78.7 kg` */
  healthyWeightLabel: string | null;
  /** e.g. `69.5 kg` */
  idealWeightLabel: string | null;
}

function Stat({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm font-medium">{value ?? '—'}</span>
    </div>
  );
}

function InfoTile({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof HeartPulse;
  label: string;
  value: string | null;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-background/40 p-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-muted-foreground">
        <Icon className="h-4 w-4" />
      </span>
      <div className="flex min-w-0 flex-col">
        <span className="truncate text-xs text-muted-foreground">{label}</span>
        <span className="truncate text-sm font-semibold">{value ?? '—'}</span>
      </div>
    </div>
  );
}

export function BmiCard({
  bmi,
  category,
  sexLabel,
  age,
  heightLabel,
  weightLabel,
  healthyWeightLabel,
  idealWeightLabel,
}: BmiCardProps) {
  if (bmi === null || category === null) {
    return (
      <div className="rounded-xl border border-border bg-card p-6">
        <p className="text-center text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Your BMI
        </p>
        <p className="mt-4 text-center text-sm text-muted-foreground">
          Add your height in Personal info and log a weight to see your BMI.
        </p>
      </div>
    );
  }

  const tone = TEXT_BY_KEY[category.key];

  return (
    <div className="rounded-xl border border-border bg-card p-6">
      {/* Headline */}
      <div className="flex flex-col items-center text-center">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Your BMI
        </p>
        <span className={cn('mt-1 text-6xl font-bold leading-none tracking-tight', tone)}>
          {bmi.toFixed(1)}
        </span>
        <span className={cn('mt-2 text-lg font-semibold', tone)}>{category.label}</span>

        <div
          className={cn(
            'mt-3 inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm font-medium',
            CALLOUT_BY_KEY[category.key],
          )}
        >
          {category.key === 'normal' ? <Check className="h-4 w-4" /> : <Info className="h-4 w-4" />}
          {CALLOUT_MESSAGE[category.key]}
        </div>

        {/* Gauge */}
        <div className="mt-5 flex w-full justify-center">
          <BmiGauge bmi={bmi} />
        </div>

        {/* Dynamic band range */}
        <div className="-mt-2 rounded-lg border border-border bg-background/40 px-4 py-2">
          <p className="text-xs text-muted-foreground">{category.label} BMI range</p>
          <p className="text-sm font-semibold">{bmiRangeLabel(category)}</p>
        </div>
      </div>

      {/* Healthy / ideal weight */}
      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <InfoTile
          icon={HeartPulse}
          label="Healthy weight for your height"
          value={healthyWeightLabel}
        />
        <InfoTile icon={Flame} label="Ideal weight to maintain" value={idealWeightLabel} />
      </div>

      {/* Stats */}
      <div className="mt-6 grid grid-cols-4 gap-3 border-t border-border pt-4">
        <Stat label="Sex" value={sexLabel} />
        <Stat label="Age" value={age !== null ? `${age} yrs` : null} />
        <Stat label="Weight" value={weightLabel} />
        <Stat label="Height" value={heightLabel} />
      </div>
    </div>
  );
}
