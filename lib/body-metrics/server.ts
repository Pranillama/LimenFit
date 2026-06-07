import type { SupabaseClient } from '@supabase/supabase-js';

import { assertServerOnly } from '@/lib/env';
import type { Database } from '@/lib/supabase/types';
import type { BodyweightEntryDTO, MeasurementsDTO } from '@/lib/schemas/body-metrics';

assertServerOnly();

type BodyweightRow = { id: string; weight_kg: number; recorded_on: string };

export function bodyweightRowToDTO(row: BodyweightRow): BodyweightEntryDTO {
  return { id: row.id, weightKg: Number(row.weight_kg), recordedOn: row.recorded_on };
}

export async function getBodyweightEntries(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<BodyweightEntryDTO[]> {
  const { data, error } = await supabase
    .from('bodyweight_entries')
    .select('id, weight_kg, recorded_on')
    .eq('user_id', userId)
    .order('recorded_on', { ascending: true });
  if (error) throw error;
  return (data ?? []).map((r) => bodyweightRowToDTO(r as unknown as BodyweightRow));
}

export async function upsertTodayBodyweight(
  supabase: SupabaseClient<Database>,
  userId: string,
  weightKg: number,
  today: string,
): Promise<BodyweightEntryDTO> {
  const { data, error } = await supabase
    .from('bodyweight_entries')
    .upsert(
      { user_id: userId, weight_kg: weightKg, recorded_on: today },
      { onConflict: 'user_id,recorded_on', ignoreDuplicates: false },
    )
    .select('id, weight_kg, recorded_on')
    .single();
  if (error) throw error;
  return bodyweightRowToDTO(data as unknown as BodyweightRow);
}

type MeasurementsRow = {
  body_fat_pct: number | null;
  waist_cm: number | null;
  chest_cm: number | null;
  arms_cm: number | null;
  legs_cm: number | null;
  recorded_on: string;
};

const MEASUREMENT_COLUMNS = 'body_fat_pct, waist_cm, chest_cm, arms_cm, legs_cm, recorded_on';

export function measurementsRowToDTO(row: MeasurementsRow): MeasurementsDTO {
  return {
    bodyFatPct: row.body_fat_pct === null ? null : Number(row.body_fat_pct),
    waistCm: row.waist_cm === null ? null : Number(row.waist_cm),
    chestCm: row.chest_cm === null ? null : Number(row.chest_cm),
    armsCm: row.arms_cm === null ? null : Number(row.arms_cm),
    legsCm: row.legs_cm === null ? null : Number(row.legs_cm),
    recordedOn: row.recorded_on,
  };
}

export async function getLatestMeasurements(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<MeasurementsDTO | null> {
  const { data, error } = await supabase
    .from('body_measurements')
    .select(MEASUREMENT_COLUMNS)
    .eq('user_id', userId)
    .order('recorded_on', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data ? measurementsRowToDTO(data as unknown as MeasurementsRow) : null;
}

export async function upsertTodayMeasurements(
  supabase: SupabaseClient<Database>,
  userId: string,
  fields: Record<string, number | null>,
  today: string,
): Promise<MeasurementsDTO> {
  const { data, error } = await supabase
    .from('body_measurements')
    .upsert(
      { user_id: userId, recorded_on: today, ...fields },
      { onConflict: 'user_id,recorded_on', ignoreDuplicates: false },
    )
    .select(MEASUREMENT_COLUMNS)
    .single();
  if (error) throw error;
  return measurementsRowToDTO(data as unknown as MeasurementsRow);
}

/** Today's date as YYYY-MM-DD (UTC). Passed explicitly to the upserts. */
export function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}
