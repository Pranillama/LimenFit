'use client';

import { useRouter } from 'next/navigation';
import * as React from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { MeasurementsDTO } from '@/lib/schemas/body-metrics';

import { useUpdateMeasurementsMutation } from '../hooks/useUpdateMeasurementsMutation';
import { cmToIn, inToCm } from '../lib/unitConversions';
import { Field } from './ui/Field';

type HeightUnit = 'ft' | 'cm';

function lengthToDisplay(cm: number | null, imperial: boolean): string {
  if (cm === null) return '';
  return imperial ? String(cmToIn(cm)) : String(Math.round(cm * 10) / 10);
}

function displayToCm(val: string, imperial: boolean): number | null {
  if (val.trim() === '') return null;
  const n = Number(val);
  if (isNaN(n) || n <= 0) return null;
  return imperial ? inToCm(n) : Math.round(n * 10) / 10;
}

export interface MeasurementsFormProps {
  measurements: MeasurementsDTO | null;
  heightUnit: HeightUnit;
}

export function MeasurementsForm({ measurements, heightUnit }: MeasurementsFormProps) {
  const router = useRouter();
  const mutation = useUpdateMeasurementsMutation();
  const imperial = heightUnit === 'ft';
  const lengthUnit = imperial ? 'in' : 'cm';

  const initial = React.useMemo(
    () => ({
      bodyFat:
        measurements?.bodyFatPct === null || measurements === null
          ? ''
          : String(measurements.bodyFatPct),
      waist: lengthToDisplay(measurements?.waistCm ?? null, imperial),
      chest: lengthToDisplay(measurements?.chestCm ?? null, imperial),
      arms: lengthToDisplay(measurements?.armsCm ?? null, imperial),
      legs: lengthToDisplay(measurements?.legsCm ?? null, imperial),
    }),
    [measurements, imperial],
  );

  const [form, setForm] = React.useState(initial);
  const [saved, setSaved] = React.useState(initial);

  const isDirty = (Object.keys(form) as Array<keyof typeof form>).some((k) => form[k] !== saved[k]);

  function set(key: keyof typeof form, val: string) {
    setForm((prev) => ({ ...prev, [key]: val }));
  }

  function handleCancel() {
    setForm(saved);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const bodyFat = form.bodyFat.trim() === '' ? null : Number(form.bodyFat);
    mutation.mutate(
      {
        bodyFatPct: bodyFat,
        waistCm: displayToCm(form.waist, imperial),
        chestCm: displayToCm(form.chest, imperial),
        armsCm: displayToCm(form.arms, imperial),
        legsCm: displayToCm(form.legs, imperial),
      },
      {
        onSuccess: () => {
          setSaved(form);
          router.refresh();
        },
      },
    );
  }

  return (
    <section>
      <h2 className="mb-3 text-lg font-semibold">Measurements</h2>
      <form onSubmit={handleSubmit} noValidate className="rounded-xl border border-border bg-card">
        <div className="grid grid-cols-2 gap-x-6 gap-y-6 p-6 lg:grid-cols-3">
          <Field label="Body fat">
            <div className="flex items-center gap-2">
              <Input
                type="number"
                inputMode="decimal"
                min={0}
                max={100}
                step="0.1"
                value={form.bodyFat}
                onChange={(e) => set('bodyFat', e.target.value)}
                aria-label="Body fat percentage"
              />
              <span className="shrink-0 text-sm text-muted-foreground">%</span>
            </div>
          </Field>

          {(
            [
              ['waist', 'Waist'],
              ['chest', 'Chest'],
              ['arms', 'Arms'],
              ['legs', 'Legs'],
            ] as Array<[keyof typeof form, string]>
          ).map(([key, label]) => (
            <Field key={key} label={label}>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="0.1"
                  value={form[key]}
                  onChange={(e) => set(key, e.target.value)}
                  aria-label={`${label} measurement`}
                />
                <span className="shrink-0 text-sm text-muted-foreground">{lengthUnit}</span>
              </div>
            </Field>
          ))}
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
            {mutation.isPending ? 'Saving…' : 'Save measurements'}
          </Button>
        </div>
      </form>
    </section>
  );
}
