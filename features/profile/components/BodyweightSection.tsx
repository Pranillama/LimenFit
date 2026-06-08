'use client';

import { TrendingDown, TrendingUp } from 'lucide-react';
import { useRouter } from 'next/navigation';
import * as React from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { weightDelta } from '@/lib/body-metrics/derive';
import type { BodyweightEntryDTO } from '@/lib/schemas/body-metrics';

import { useLogBodyweightMutation } from '../hooks/useLogBodyweightMutation';
import { kgToLbs, lbsToKg } from '../lib/unitConversions';
import { WeightChart } from './WeightChart';

type WeightUnit = 'lbs' | 'kg';

function toDisplay(kg: number, unit: WeightUnit): number {
  return unit === 'lbs' ? kgToLbs(kg) : Math.round(kg * 10) / 10;
}

export interface BodyweightSectionProps {
  entries: BodyweightEntryDTO[];
  weightUnit: WeightUnit;
}

export function BodyweightSection({ entries, weightUnit }: BodyweightSectionProps) {
  const router = useRouter();
  const mutation = useLogBodyweightMutation();
  const [value, setValue] = React.useState('');

  const sorted = React.useMemo(
    () => [...entries].sort((a, b) => a.recordedOn.localeCompare(b.recordedOn)),
    [entries],
  );
  const current = sorted.at(-1) ?? null;
  const delta = weightDelta(entries);

  const points = sorted.map((e) => ({
    date: e.recordedOn,
    weight: toDisplay(e.weightKg, weightUnit),
  }));
  const currentDisplay = current ? toDisplay(current.weightKg, weightUnit) : null;
  const deltaDisplay = delta ? toDisplay(Math.abs(delta.deltaKg), weightUnit) : null;
  const isLoss = delta ? delta.deltaKg < 0 : false;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const n = Number(value);
    if (isNaN(n) || n <= 0) return;
    const weightKg = weightUnit === 'lbs' ? lbsToKg(n) : n;
    mutation.mutate(
      { weightKg },
      {
        onSuccess: () => {
          setValue('');
          router.refresh();
        },
      },
    );
  }

  return (
    <section>
      <div className="mb-3 flex items-end justify-between">
        <h2 className="text-lg font-semibold">Bodyweight</h2>
        <span className="text-sm text-muted-foreground">{entries.length} entries</span>
      </div>

      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Current
            </p>
            <p className="mt-1 text-3xl font-bold leading-none">
              {currentDisplay ?? '—'}
              {currentDisplay !== null ? (
                <span className="ml-1 text-base font-normal text-muted-foreground">
                  {weightUnit}
                </span>
              ) : null}
            </p>
          </div>
          {delta && deltaDisplay !== null ? (
            <span
              className={cn(
                'inline-flex items-center gap-1 rounded-full border px-3 py-1 text-sm font-semibold',
                isLoss
                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                  : 'border-amber-500/30 bg-amber-500/10 text-amber-400',
              )}
            >
              {isLoss ? <TrendingDown className="h-4 w-4" /> : <TrendingUp className="h-4 w-4" />}
              {isLoss ? '-' : '+'}
              {deltaDisplay} {weightUnit} · {delta.weeks} wk
            </span>
          ) : null}
        </div>

        {points.length > 0 ? (
          <div className="mt-4">
            <WeightChart points={points} unitLabel={weightUnit} />
          </div>
        ) : (
          <p className="mt-4 text-sm text-muted-foreground">Log a few entries to see your trend.</p>
        )}

        <form onSubmit={handleSubmit} className="mt-6 border-t border-border pt-6">
          <label htmlFor="log-weight" className="block text-base font-medium">
            Log today&rsquo;s weight
          </label>
          <div className="mt-3 flex items-center gap-3">
            <Input
              id="log-weight"
              type="number"
              inputMode="decimal"
              min={0}
              step="0.1"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={currentDisplay !== null ? String(currentDisplay) : '0'}
              aria-label="Today's weight"
            />
            <span className="shrink-0 text-sm text-muted-foreground">{weightUnit}</span>
            <Button type="submit" disabled={value.trim() === '' || mutation.isPending}>
              {mutation.isPending ? 'Saving…' : '+ Add entry'}
            </Button>
          </div>
        </form>
      </div>
    </section>
  );
}
