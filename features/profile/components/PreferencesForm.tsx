'use client';

import { Minus, Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import * as React from 'react';

import { Button } from '@/components/ui/button';

import { useUpdatePreferencesMutation } from '../hooks/useUpdatePreferencesMutation';
import { Field } from './ui/Field';
import { Segmented } from './ui/Segmented';

type WeightUnit = 'lbs' | 'kg';
type HeightUnit = 'ft' | 'cm';

const WEIGHT_UNIT_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'lbs', label: 'lbs' },
  { value: 'kg', label: 'kg' },
];

const HEIGHT_UNIT_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'ft', label: 'ft' },
  { value: 'cm', label: 'cm' },
];

export interface PreferencesFormProps {
  defaultWeightUnit: WeightUnit;
  defaultHeightUnit: HeightUnit;
  defaultRestTimerSeconds: number;
}

export function PreferencesForm({
  defaultWeightUnit,
  defaultHeightUnit,
  defaultRestTimerSeconds,
}: PreferencesFormProps) {
  const router = useRouter();
  const mutation = useUpdatePreferencesMutation();

  // Tracks what's persisted — used for dirty comparison and cancel
  const [saved, setSaved] = React.useState({
    weightUnit: defaultWeightUnit,
    heightUnit: defaultHeightUnit,
    restSeconds: defaultRestTimerSeconds,
  });

  const [weightUnit, setWeightUnit] = React.useState<WeightUnit>(defaultWeightUnit);
  const [heightUnit, setHeightUnit] = React.useState<HeightUnit>(defaultHeightUnit);
  const [restSeconds, setRestSeconds] = React.useState(defaultRestTimerSeconds);

  const isDirty =
    weightUnit !== saved.weightUnit ||
    heightUnit !== saved.heightUnit ||
    restSeconds !== saved.restSeconds;

  function handleCancel() {
    setWeightUnit(saved.weightUnit);
    setHeightUnit(saved.heightUnit);
    setRestSeconds(saved.restSeconds);
  }

  function handleRestStep(delta: number) {
    setRestSeconds((prev) => Math.min(600, Math.max(0, prev + delta)));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    mutation.mutate(
      { weightUnit, heightUnit, restTimerDefaultSeconds: restSeconds },
      {
        onSuccess: (updated) => {
          const next = {
            weightUnit: updated.weightUnit,
            heightUnit: updated.heightUnit,
            restSeconds: updated.restTimerDefaultSeconds,
          };
          setSaved(next);
          setWeightUnit(next.weightUnit);
          setHeightUnit(next.heightUnit);
          setRestSeconds(next.restSeconds);
          router.refresh();
        },
      },
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Preferences</h1>
        <p className="mt-1 text-sm text-muted-foreground">How the app behaves for you.</p>
      </div>
      <div className="rounded-xl border border-border bg-card">
        <div className="space-y-6 p-6">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <Field label="Weight unit" hint="Default for new sets.">
              <Segmented
                options={WEIGHT_UNIT_OPTIONS}
                value={weightUnit}
                onChange={(val) => setWeightUnit(val as WeightUnit)}
                ariaLabel="Weight unit"
              />
            </Field>
            <Field label="Height unit" hint="Used for height inputs.">
              <Segmented
                options={HEIGHT_UNIT_OPTIONS}
                value={heightUnit}
                onChange={(val) => setHeightUnit(val as HeightUnit)}
                ariaLabel="Height unit"
              />
            </Field>
          </div>

          <Field label="Default rest timer" hint="Used when starting a new rest timer.">
            <div className="flex items-center gap-3">
              <div className="flex items-center rounded-md border border-input bg-card">
                <button
                  type="button"
                  onClick={() => handleRestStep(-15)}
                  disabled={restSeconds <= 0}
                  aria-label="Decrease by 15 seconds"
                  className="flex h-9 w-9 items-center justify-center rounded-l-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-40"
                >
                  <Minus className="h-4 w-4" />
                </button>
                <span className="min-w-[3rem] px-3 text-center text-sm font-medium tabular-nums">
                  {restSeconds}
                </span>
                <button
                  type="button"
                  onClick={() => handleRestStep(15)}
                  disabled={restSeconds >= 600}
                  aria-label="Increase by 15 seconds"
                  className="flex h-9 w-9 items-center justify-center rounded-r-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-40"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
              <span className="text-sm text-muted-foreground">seconds</span>
            </div>
          </Field>
        </div>
        <div className="flex justify-end gap-3 border-t border-border px-6 py-4">
          <Button
            type="button"
            variant="ghost"
            disabled={!isDirty || mutation.isPending}
            onClick={handleCancel}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={!isDirty || mutation.isPending}>
            {mutation.isPending ? 'Saving…' : 'Save changes'}
          </Button>
        </div>
      </div>
    </form>
  );
}
