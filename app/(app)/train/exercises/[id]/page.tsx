import Link from 'next/link';
import { notFound } from 'next/navigation';

import { PageContainer } from '@/components/page-container';
import { createSupabaseServerClient } from '@/lib/supabase/server-exports';
import { UUID_RE } from '@/lib/utils';
import { getOneRepMaxSeriesForExercise } from '@/lib/insights';
import { EXERCISE_CATEGORY_OPTIONS } from '@/lib/exercises/catalog';
import type { ExerciseCategory } from '@/lib/exercises/catalog';
import { OneRepMaxTrendChart } from '@/features/insights/components/OneRepMaxTrendChart';
import type { WeightUnit } from '@/features/insights/lib/types';

export default async function ExerciseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  if (!UUID_RE.test(id)) {
    notFound();
  }

  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    notFound();
  }

  const { data: exercise, error: exerciseError } = await supabase
    .from('exercises')
    .select('id, name, category, equipment, is_custom')
    .eq('id', id)
    .or(`user_id.is.null,user_id.eq.${user.id}`)
    .maybeSingle();

  if (exerciseError) throw exerciseError;
  if (!exercise) notFound();

  const [points, sessionsResult] = await Promise.all([
    getOneRepMaxSeriesForExercise(user.id, id),
    supabase
      .from('workouts')
      .select(
        `id, name, started_at, completed_at,
         workout_exercises!inner ( exercise_id )`,
      )
      .eq('user_id', user.id)
      .eq('status', 'completed')
      .eq('workout_exercises.exercise_id', id)
      .order('started_at', { ascending: false })
      .limit(5),
  ]);

  if (sessionsResult.error) throw sessionsResult.error;
  const recentSessions = sessionsResult.data ?? [];

  const sortedPoints = [...points].sort(
    (a, b) => new Date(a.workoutDate).getTime() - new Date(b.workoutDate).getTime(),
  );

  // Pick the dominant unit by frequency across all points so mixed-unit histories
  // don't cross-contaminate stats (e.g. a kg point labelled as lbs).
  const unitCounts = sortedPoints.reduce<Partial<Record<WeightUnit, number>>>((acc, p) => {
    acc[p.weightUnit] = (acc[p.weightUnit] ?? 0) + 1;
    return acc;
  }, {});
  const unit: WeightUnit =
    (Object.entries(unitCounts).sort(
      ([, a], [, b]) => (b ?? 0) - (a ?? 0),
    )[0]?.[0] as WeightUnit) ?? 'lbs';
  const normalizedPoints = sortedPoints.filter((p) => p.weightUnit === unit);

  const bestE1rm = normalizedPoints.reduce<number | null>(
    (best, p) => (p.e1rm > (best ?? 0) ? p.e1rm : best),
    null,
  );
  const lastE1rm = normalizedPoints[normalizedPoints.length - 1]?.e1rm ?? null;

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const last30Points = normalizedPoints.filter((p) => new Date(p.workoutDate) >= thirtyDaysAgo);
  const delta30 =
    last30Points.length >= 2
      ? last30Points[last30Points.length - 1]!.e1rm - last30Points[0]!.e1rm
      : null;

  const categoryLabel =
    EXERCISE_CATEGORY_OPTIONS.find((o) => o.value === (exercise.category as ExerciseCategory))
      ?.label ?? exercise.category;

  const dateFormat = new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <PageContainer>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">{exercise.name}</h1>
            <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
              {categoryLabel}
            </span>
            {exercise.is_custom && (
              <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                Custom
              </span>
            )}
          </div>
        </div>

        {/* 1RM Trend Chart */}
        <div className="rounded-lg border bg-card p-4">
          <h2 className="mb-3 text-sm font-semibold">Est. 1RM Trend</h2>
          <OneRepMaxTrendChart points={normalizedPoints} unit={unit} />
        </div>

        {/* Stats block */}
        {bestE1rm !== null && (
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-lg border bg-card px-4 py-3 text-center">
              <p className="text-xs text-muted-foreground">Best e1RM</p>
              <p className="mt-1 text-lg font-semibold">
                {Math.round(bestE1rm)}{' '}
                <span className="text-xs font-normal text-muted-foreground">{unit}</span>
              </p>
            </div>
            <div className="rounded-lg border bg-card px-4 py-3 text-center">
              <p className="text-xs text-muted-foreground">Last e1RM</p>
              <p className="mt-1 text-lg font-semibold">
                {lastE1rm !== null ? Math.round(lastE1rm) : '—'}{' '}
                {lastE1rm !== null && (
                  <span className="text-xs font-normal text-muted-foreground">{unit}</span>
                )}
              </p>
            </div>
            <div className="rounded-lg border bg-card px-4 py-3 text-center">
              <p className="text-xs text-muted-foreground">30-day delta</p>
              <p
                className={[
                  'mt-1 text-lg font-semibold',
                  delta30 === null
                    ? ''
                    : delta30 > 0
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : delta30 < 0
                        ? 'text-red-600 dark:text-red-400'
                        : '',
                ].join(' ')}
              >
                {delta30 === null ? '—' : `${delta30 > 0 ? '+' : ''}${Math.round(delta30)}`}{' '}
                {delta30 !== null && (
                  <span className="text-xs font-normal text-muted-foreground">{unit}</span>
                )}
              </p>
            </div>
          </div>
        )}

        {/* Recent sessions */}
        <div>
          <h2 className="mb-3 text-sm font-semibold">Recent Sessions</h2>
          {recentSessions.length > 0 ? (
            <div className="space-y-2">
              {recentSessions.map((w) => (
                <Link
                  key={w.id}
                  href={`/train/history/${w.id}`}
                  className="flex items-center justify-between rounded-lg border bg-card px-4 py-3 text-sm hover:bg-accent"
                >
                  <span className="font-medium">{w.name ?? 'Workout'}</span>
                  <span className="text-muted-foreground">
                    {dateFormat.format(new Date(w.started_at))}
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No completed sessions yet.</p>
          )}
        </div>
      </div>
    </PageContainer>
  );
}
