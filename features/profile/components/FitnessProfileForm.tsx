'use client';

import { Clock, Dumbbell, Target, TrendingDown, Zap } from 'lucide-react';
import { useRouter } from 'next/navigation';
import * as React from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { ProfileDTO } from '@/lib/schemas/profile';

import { useUpdateProfileMutation } from '../hooks/useUpdateProfileMutation';
import { kgToLbs, lbsToKg } from '../lib/unitConversions';
import { Field } from './ui/Field';
import { GoalGrid, type GoalOption } from './ui/GoalGrid';
import { RangeSlider } from './ui/RangeSlider';
import { Segmented } from './ui/Segmented';
import { Select } from './ui/Select';

type WeightUnit = 'lbs' | 'kg';
type FitnessGoal = 'fat_loss' | 'muscle_gain' | 'strength' | 'endurance' | 'general_fitness';
type ActivityLevel = 'sedentary' | 'lightly_active' | 'moderately_active' | 'very_active';
type TrainingExperience = 'beginner' | 'intermediate' | 'advanced';

const FREQ_MIN = 2;
const FREQ_MAX = 6;
const FREQ_FALLBACK = 4;

const GOAL_OPTIONS: GoalOption<FitnessGoal>[] = [
  { value: 'fat_loss', label: 'Fat Loss', icon: TrendingDown },
  { value: 'muscle_gain', label: 'Muscle Gain', icon: Dumbbell },
  { value: 'strength', label: 'Strength', icon: Zap },
  { value: 'endurance', label: 'Endurance', icon: Clock },
  { value: 'general_fitness', label: 'General Fitness', icon: Target },
];

const ACTIVITY_OPTIONS: Array<{ value: ActivityLevel; label: string }> = [
  { value: 'sedentary', label: 'Sedentary' },
  { value: 'lightly_active', label: 'Lightly Active' },
  { value: 'moderately_active', label: 'Moderately Active' },
  { value: 'very_active', label: 'Very Active' },
];

const EXPERIENCE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'beginner', label: 'Beginner' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'advanced', label: 'Advanced' },
];

function weightToDisplay(kg: number | null, unit: WeightUnit): string {
  if (kg === null) return '';
  return unit === 'lbs' ? String(kgToLbs(kg)) : String(Math.round(kg * 10) / 10);
}

export interface FitnessProfileFormProps {
  profile: ProfileDTO;
  defaultWeightUnit: WeightUnit;
}

export function FitnessProfileForm({ profile, defaultWeightUnit }: FitnessProfileFormProps) {
  const router = useRouter();
  const mutation = useUpdateProfileMutation();
  const weightUnit = defaultWeightUnit;

  // Persisted snapshot — drives dirty comparison and Cancel.
  const [saved, setSaved] = React.useState({
    primaryGoal: profile.primaryGoal as FitnessGoal | null,
    goalWeightKg: profile.goalWeightKg,
    targetDailyCalories: profile.targetDailyCalories,
    activityLevel: profile.activityLevel as ActivityLevel | null,
    trainingExperience: profile.trainingExperience as TrainingExperience | null,
    weeklyTrainingFrequency: profile.weeklyTrainingFrequency,
  });

  const [primaryGoal, setPrimaryGoal] = React.useState<FitnessGoal | null>(saved.primaryGoal);
  const [goalWeightKg, setGoalWeightKg] = React.useState<number | null>(saved.goalWeightKg);
  const [goalWeightDisplay, setGoalWeightDisplay] = React.useState(() =>
    weightToDisplay(saved.goalWeightKg, weightUnit),
  );
  const [calories, setCalories] = React.useState<number | null>(saved.targetDailyCalories);
  const [caloriesDisplay, setCaloriesDisplay] = React.useState(() =>
    saved.targetDailyCalories === null ? '' : String(saved.targetDailyCalories),
  );
  const [activityLevel, setActivityLevel] = React.useState<ActivityLevel | null>(
    saved.activityLevel,
  );
  const [experience, setExperience] = React.useState<TrainingExperience | null>(
    saved.trainingExperience,
  );
  // null until the slider is touched, so we never silently write a default.
  const [frequency, setFrequency] = React.useState<number | null>(saved.weeklyTrainingFrequency);

  const isDirty =
    primaryGoal !== saved.primaryGoal ||
    goalWeightKg !== saved.goalWeightKg ||
    calories !== saved.targetDailyCalories ||
    activityLevel !== saved.activityLevel ||
    experience !== saved.trainingExperience ||
    frequency !== saved.weeklyTrainingFrequency;

  function handleGoalWeightChange(val: string) {
    setGoalWeightDisplay(val);
    if (val.trim() === '') {
      setGoalWeightKg(null);
      return;
    }
    const n = Number(val);
    if (!isNaN(n) && n > 0) {
      setGoalWeightKg(weightUnit === 'lbs' ? lbsToKg(n) : n);
    }
  }

  function handleCaloriesChange(val: string) {
    setCaloriesDisplay(val);
    if (val.trim() === '') {
      setCalories(null);
      return;
    }
    const n = Number(val);
    if (!isNaN(n) && n > 0) {
      setCalories(Math.round(n));
    }
  }

  function syncFromSaved(next: typeof saved) {
    setPrimaryGoal(next.primaryGoal);
    setGoalWeightKg(next.goalWeightKg);
    setGoalWeightDisplay(weightToDisplay(next.goalWeightKg, weightUnit));
    setCalories(next.targetDailyCalories);
    setCaloriesDisplay(next.targetDailyCalories === null ? '' : String(next.targetDailyCalories));
    setActivityLevel(next.activityLevel);
    setExperience(next.trainingExperience);
    setFrequency(next.weeklyTrainingFrequency);
  }

  function handleCancel() {
    syncFromSaved(saved);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    mutation.mutate(
      {
        primaryGoal,
        goalWeightKg,
        targetDailyCalories: calories,
        activityLevel,
        trainingExperience: experience,
        weeklyTrainingFrequency: frequency,
      },
      {
        onSuccess: (updated) => {
          const next = {
            primaryGoal: updated.primaryGoal as FitnessGoal | null,
            goalWeightKg: updated.goalWeightKg,
            targetDailyCalories: updated.targetDailyCalories,
            activityLevel: updated.activityLevel as ActivityLevel | null,
            trainingExperience: updated.trainingExperience as TrainingExperience | null,
            weeklyTrainingFrequency: updated.weeklyTrainingFrequency,
          };
          setSaved(next);
          syncFromSaved(next);
          router.refresh();
        },
      },
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Fitness profile</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          What you&rsquo;re training for and how hard.
        </p>
      </div>
      <div className="rounded-xl border border-border bg-card">
        <div className="space-y-6 p-6">
          {/* Primary goal */}
          <Field label="Primary goal">
            <GoalGrid
              options={GOAL_OPTIONS}
              value={primaryGoal}
              onChange={setPrimaryGoal}
              ariaLabel="Primary goal"
            />
          </Field>

          {/* Goal weight + Target daily calories */}
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <Field label="Goal weight">
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  max={999}
                  value={goalWeightDisplay}
                  onChange={(e) => handleGoalWeightChange(e.target.value)}
                  placeholder="0"
                  aria-label="Goal weight"
                />
                <span className="shrink-0 text-sm text-muted-foreground">{weightUnit}</span>
              </div>
            </Field>

            <Field label="Target daily calories" hint="Optional.">
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={20000}
                  value={caloriesDisplay}
                  onChange={(e) => handleCaloriesChange(e.target.value)}
                  placeholder="0"
                  aria-label="Target daily calories"
                />
                <span className="shrink-0 text-sm text-muted-foreground">kcal</span>
              </div>
            </Field>
          </div>

          {/* Activity level */}
          <Field label="Activity level" htmlFor="activity-level">
            <Select
              id="activity-level"
              options={ACTIVITY_OPTIONS}
              value={activityLevel}
              onChange={setActivityLevel}
              placeholder="Select your activity level"
              ariaLabel="Activity level"
            />
          </Field>

          {/* Training experience */}
          <Field label="Training experience">
            <Segmented
              options={EXPERIENCE_OPTIONS}
              value={experience ?? ''}
              onChange={(val) =>
                setExperience(experience === val ? null : (val as TrainingExperience))
              }
              ariaLabel="Training experience"
            />
          </Field>

          {/* Weekly training frequency */}
          <Field
            label="Weekly training frequency"
            hint="How many days you plan to train each week."
          >
            <RangeSlider
              min={FREQ_MIN}
              max={FREQ_MAX}
              value={frequency ?? FREQ_FALLBACK}
              onChange={setFrequency}
              ariaLabel="Weekly training frequency"
              valueLabel={
                <>
                  {frequency ?? FREQ_FALLBACK}{' '}
                  <span className="text-muted-foreground">days/wk</span>
                </>
              }
            />
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
