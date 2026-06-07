import {
  BmiCard,
  BodyweightSection,
  MeasurementsForm,
  ProgressPhotosPlaceholder,
} from '@/features/profile';
import { cmToFtIn, kgToLbs } from '@/features/profile/lib/unitConversions';
import {
  ageFromDob,
  bmiCategory,
  computeBmi,
  healthyWeightRange,
  idealWeight,
} from '@/lib/body-metrics/derive';
import { getBodyweightEntries, getLatestMeasurements } from '@/lib/body-metrics/server';
import { getOrCreateProfile } from '@/lib/profile';
import { createSupabaseServerClient } from '@/lib/supabase/server-exports';

export default async function BodyMetricsPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const [profile, settingsResult, entries, measurements] = await Promise.all([
    getOrCreateProfile(supabase, user.id),
    supabase
      .from('user_settings')
      .select('weight_unit, height_unit')
      .eq('user_id', user.id)
      .maybeSingle(),
    getBodyweightEntries(supabase, user.id),
    getLatestMeasurements(supabase, user.id),
  ]);

  const weightUnit: 'lbs' | 'kg' = settingsResult.data?.weight_unit ?? 'lbs';
  const heightUnit: 'ft' | 'cm' = settingsResult.data?.height_unit ?? 'ft';

  // BMI uses the latest logged weight, falling back to the profile's starting weight.
  const latestWeightKg =
    entries.length > 0
      ? (entries[entries.length - 1]?.weightKg ?? profile.startingWeightKg)
      : profile.startingWeightKg;
  const bmi = computeBmi(profile.heightCm, latestWeightKg);
  const category = bmi === null ? null : bmiCategory(bmi);

  let heightLabel: string | null = null;
  if (profile.heightCm !== null) {
    if (heightUnit === 'ft') {
      const { ft, in: inches } = cmToFtIn(profile.heightCm);
      heightLabel = `${ft}'${inches}"`;
    } else {
      heightLabel = `${Math.round(profile.heightCm)} cm`;
    }
  }

  const formatWeight = (kg: number): string =>
    weightUnit === 'lbs' ? `${kgToLbs(kg)}` : `${Math.round(kg * 10) / 10}`;

  let weightLabel: string | null = null;
  if (latestWeightKg !== null) {
    weightLabel = `${formatWeight(latestWeightKg)} ${weightUnit}`;
  }

  const genderLabels: Record<string, string> = { male: 'Male', female: 'Female' };
  const sexLabel = profile.gender ? (genderLabels[profile.gender] ?? null) : null;
  const age = ageFromDob(profile.dateOfBirth);

  const healthy = healthyWeightRange(profile.heightCm);
  const healthyWeightLabel = healthy
    ? `${formatWeight(healthy.minKg)} – ${formatWeight(healthy.maxKg)} ${weightUnit}`
    : null;
  const idealKg = idealWeight(profile.heightCm);
  const idealWeightLabel = idealKg !== null ? `${formatWeight(idealKg)} ${weightUnit}` : null;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold">Body metrics</h1>
        <p className="mt-1 text-sm text-muted-foreground">Track your composition over time.</p>
      </div>

      <BmiCard
        bmi={bmi}
        category={category}
        sexLabel={sexLabel}
        age={age}
        heightLabel={heightLabel}
        weightLabel={weightLabel}
        healthyWeightLabel={healthyWeightLabel}
        idealWeightLabel={idealWeightLabel}
      />
      <BodyweightSection entries={entries} weightUnit={weightUnit} />
      <MeasurementsForm measurements={measurements} heightUnit={heightUnit} />
      <ProgressPhotosPlaceholder />
    </div>
  );
}
