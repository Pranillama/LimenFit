'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type { ProfileDTO } from '@/lib/schemas/profile';

import { useUpdateProfileMutation } from '../hooks/useUpdateProfileMutation';
import { cmToFtIn, ftInToCm, kgToLbs, lbsToKg } from '../lib/unitConversions';
import { COMMON_TIMEZONES } from '../lib/timezones';
import { Field } from './ui/Field';
import { Segmented } from './ui/Segmented';

type HeightUnit = 'ft' | 'cm';
type WeightUnit = 'lbs' | 'kg';
type Gender = 'male' | 'female' | 'prefer_not_to_say';

const schema = z.object({
  firstName: z.string().trim().max(120),
  lastName: z.string().trim().max(120),
  dateOfBirth: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be a valid date')
    .or(z.literal('')),
  gender: z.enum(['male', 'female', 'prefer_not_to_say', '']),
  timeZone: z.string(),
});

type FormValues = z.infer<typeof schema>;

const GENDER_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'prefer_not_to_say', label: 'Prefer not to say' },
];

const HEIGHT_UNIT_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'ft', label: 'ft' },
  { value: 'cm', label: 'cm' },
];

const WEIGHT_UNIT_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'lbs', label: 'lbs' },
  { value: 'kg', label: 'kg' },
];

function computeAge(dob: string): number | null {
  try {
    const birth = new Date(dob);
    if (isNaN(birth.getTime())) return null;
    const now = new Date();
    let age = now.getFullYear() - birth.getFullYear();
    const m = now.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--;
    return age >= 0 ? age : null;
  } catch {
    return null;
  }
}

export interface PersonalInfoFormProps {
  profile: ProfileDTO;
  defaultHeightUnit: HeightUnit;
  defaultWeightUnit: WeightUnit;
}

export function PersonalInfoForm({
  profile,
  defaultHeightUnit,
  defaultWeightUnit,
}: PersonalInfoFormProps) {
  const router = useRouter();
  const mutation = useUpdateProfileMutation();

  // Unit toggles — local only, don't persist to user_settings
  const [heightUnit, setHeightUnit] = React.useState<HeightUnit>(defaultHeightUnit);
  const [weightUnit, setWeightUnit] = React.useState<WeightUnit>(defaultWeightUnit);

  // Canonical values in cm / kg — source of truth for what gets saved
  const [heightCmValue, setHeightCmValue] = React.useState<number | null>(profile.heightCm);
  const [weightKgValue, setWeightKgValue] = React.useState<number | null>(profile.startingWeightKg);

  // Display values for unit-sensitive inputs
  const [heightFt, setHeightFt] = React.useState(() => {
    if (profile.heightCm === null || defaultHeightUnit !== 'ft') return '';
    return String(cmToFtIn(profile.heightCm).ft);
  });
  const [heightIn, setHeightIn] = React.useState(() => {
    if (profile.heightCm === null || defaultHeightUnit !== 'ft') return '';
    return String(cmToFtIn(profile.heightCm).in);
  });
  const [heightCmDisplay, setHeightCmDisplay] = React.useState(() => {
    if (profile.heightCm === null || defaultHeightUnit !== 'cm') return '';
    return String(Math.round(profile.heightCm));
  });
  const [weightDisplay, setWeightDisplay] = React.useState(() => {
    if (profile.startingWeightKg === null) return '';
    return defaultWeightUnit === 'lbs'
      ? String(kgToLbs(profile.startingWeightKg))
      : String(Math.round(profile.startingWeightKg * 10) / 10);
  });

  // Dirty flags for unit-sensitive fields (react-hook-form doesn't know about these)
  const [heightDirty, setHeightDirty] = React.useState(false);
  const [weightDirty, setWeightDirty] = React.useState(false);

  const { register, handleSubmit, formState, reset, watch, setValue } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      firstName: profile.firstName ?? '',
      lastName: profile.lastName ?? '',
      dateOfBirth: profile.dateOfBirth ?? '',
      gender: (profile.gender ?? '') as FormValues['gender'],
      timeZone: profile.timeZone ?? '',
    },
  });

  const dobValue = watch('dateOfBirth');
  const genderValue = watch('gender');
  const age = dobValue ? computeAge(dobValue) : null;
  const isDirty = formState.isDirty || heightDirty || weightDirty;

  // ─── Height unit toggle ──────────────────────────────────────
  function handleHeightUnitChange(unit: string) {
    const next = unit as HeightUnit;
    setHeightUnit(next);
    if (heightCmValue !== null) {
      if (next === 'ft') {
        const converted = cmToFtIn(heightCmValue);
        setHeightFt(String(converted.ft));
        setHeightIn(String(converted.in));
        setHeightCmDisplay('');
      } else {
        setHeightCmDisplay(String(Math.round(heightCmValue)));
        setHeightFt('');
        setHeightIn('');
      }
    }
  }

  function handleHeightFtChange(val: string) {
    setHeightFt(val);
    const ft = Number(val);
    const inches = Number(heightIn) || 0;
    if (!isNaN(ft) && ft >= 0) {
      setHeightCmValue(ftInToCm(ft, inches));
      setHeightDirty(true);
    }
  }

  function handleHeightInChange(val: string) {
    setHeightIn(val);
    const ft = Number(heightFt) || 0;
    const inches = Number(val);
    if (!isNaN(inches) && inches >= 0) {
      setHeightCmValue(ftInToCm(ft, inches));
      setHeightDirty(true);
    }
  }

  function handleHeightCmDisplayChange(val: string) {
    setHeightCmDisplay(val);
    const cm = Number(val);
    if (!isNaN(cm) && cm > 0) {
      setHeightCmValue(cm);
      setHeightDirty(true);
    }
  }

  // ─── Weight unit toggle ──────────────────────────────────────
  function handleWeightUnitChange(unit: string) {
    const next = unit as WeightUnit;
    setWeightUnit(next);
    if (weightKgValue !== null) {
      setWeightDisplay(
        next === 'lbs'
          ? String(kgToLbs(weightKgValue))
          : String(Math.round(weightKgValue * 10) / 10),
      );
    }
  }

  function handleWeightDisplayChange(val: string) {
    setWeightDisplay(val);
    const n = Number(val);
    if (!isNaN(n) && n > 0) {
      setWeightKgValue(weightUnit === 'lbs' ? lbsToKg(n) : n);
      setWeightDirty(true);
    }
  }

  // ─── Cancel ─────────────────────────────────────────────────
  function handleCancel() {
    reset();

    setHeightCmValue(profile.heightCm);
    setHeightDirty(false);
    if (profile.heightCm !== null) {
      if (heightUnit === 'ft') {
        const converted = cmToFtIn(profile.heightCm);
        setHeightFt(String(converted.ft));
        setHeightIn(String(converted.in));
      } else {
        setHeightCmDisplay(String(Math.round(profile.heightCm)));
      }
    } else {
      setHeightFt('');
      setHeightIn('');
      setHeightCmDisplay('');
    }

    setWeightKgValue(profile.startingWeightKg);
    setWeightDirty(false);
    if (profile.startingWeightKg !== null) {
      setWeightDisplay(
        weightUnit === 'lbs'
          ? String(kgToLbs(profile.startingWeightKg))
          : String(Math.round(profile.startingWeightKg * 10) / 10),
      );
    } else {
      setWeightDisplay('');
    }
  }

  // ─── Submit ──────────────────────────────────────────────────
  function onSubmit(values: FormValues) {
    mutation.mutate(
      {
        firstName: values.firstName.trim() || null,
        lastName: values.lastName.trim() || null,
        dateOfBirth: values.dateOfBirth || null,
        gender: (values.gender as Gender) || null,
        heightCm: heightCmValue,
        startingWeightKg: weightKgValue,
        timeZone: values.timeZone || null,
      },
      {
        onSuccess: (updated) => {
          router.refresh();
          reset({
            firstName: updated.firstName ?? '',
            lastName: updated.lastName ?? '',
            dateOfBirth: updated.dateOfBirth ?? '',
            gender: (updated.gender ?? '') as FormValues['gender'],
            timeZone: updated.timeZone ?? '',
          });
          setHeightCmValue(updated.heightCm);
          setWeightKgValue(updated.startingWeightKg);
          setHeightDirty(false);
          setWeightDirty(false);
        },
      },
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Personal info</h1>
        <p className="mt-1 text-sm text-muted-foreground">Your identity and physical baseline.</p>
      </div>
      <div className="rounded-xl border border-border bg-card">
        <div className="space-y-6 p-6">
          {/* First name + Last name */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="First name" htmlFor="first-name">
              <Input id="first-name" {...register('firstName')} placeholder="First name" />
            </Field>
            <Field label="Last name" htmlFor="last-name">
              <Input id="last-name" {...register('lastName')} placeholder="Last name" />
            </Field>
          </div>

          {/* Date of birth + Gender */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field
              label="Date of birth"
              htmlFor="date-of-birth"
              hint={age !== null ? `Age: ${age} yrs` : undefined}
              error={formState.errors.dateOfBirth?.message}
            >
              <Input id="date-of-birth" type="date" {...register('dateOfBirth')} />
            </Field>

            <Field label="Gender" hint="Optional.">
              <Segmented
                options={GENDER_OPTIONS}
                value={genderValue}
                onChange={(val) =>
                  setValue('gender', genderValue === val ? '' : (val as FormValues['gender']), {
                    shouldDirty: true,
                  })
                }
                ariaLabel="Gender"
              />
            </Field>
          </div>

          {/* Height */}
          <Field label="Height">
            <div className="flex flex-wrap items-center gap-2">
              {heightUnit === 'ft' ? (
                <>
                  <Input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={9}
                    value={heightFt}
                    onChange={(e) => handleHeightFtChange(e.target.value)}
                    placeholder="0"
                    aria-label="Feet"
                    className="w-20"
                  />
                  <span className="text-sm text-muted-foreground">ft</span>
                  <Input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={11}
                    value={heightIn}
                    onChange={(e) => handleHeightInChange(e.target.value)}
                    placeholder="0"
                    aria-label="Inches"
                    className="w-20"
                  />
                  <span className="text-sm text-muted-foreground">in</span>
                </>
              ) : (
                <>
                  <Input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    max={300}
                    value={heightCmDisplay}
                    onChange={(e) => handleHeightCmDisplayChange(e.target.value)}
                    placeholder="0"
                    aria-label="Height in centimetres"
                    className="w-28"
                  />
                  <span className="text-sm text-muted-foreground">cm</span>
                </>
              )}
              <Segmented
                options={HEIGHT_UNIT_OPTIONS}
                value={heightUnit}
                onChange={handleHeightUnitChange}
                ariaLabel="Height unit"
              />
            </div>
          </Field>

          {/* Starting weight */}
          <Field label="Starting weight">
            <div className="flex flex-wrap items-center gap-2">
              <Input
                type="number"
                inputMode="decimal"
                min={0}
                max={999}
                value={weightDisplay}
                onChange={(e) => handleWeightDisplayChange(e.target.value)}
                placeholder="0"
                aria-label="Starting weight"
                className="w-28"
              />
              <Segmented
                options={WEIGHT_UNIT_OPTIONS}
                value={weightUnit}
                onChange={handleWeightUnitChange}
                ariaLabel="Weight unit"
              />
            </div>
          </Field>

          {/* Time zone */}
          <Field label="Time zone" htmlFor="time-zone">
            <select
              id="time-zone"
              value={watch('timeZone')}
              onChange={(e) => setValue('timeZone', e.target.value, { shouldDirty: true })}
              className={cn(
                'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1',
                'text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1',
                'focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
                '[&>option]:bg-card',
              )}
            >
              <option value="">Select your time zone</option>
              {COMMON_TIMEZONES.map((tz) => (
                <option key={tz.value} value={tz.value}>
                  {tz.label}
                </option>
              ))}
            </select>
          </Field>
        </div>{' '}
        {/* end fields */}
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
      </div>{' '}
      {/* end card */}
    </form>
  );
}
