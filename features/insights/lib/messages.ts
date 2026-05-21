import type { InsightMessage, InsightsBundle, OneRepMaxPoint, VolumeTrendPoint } from './types';

interface MessageContext {
  exerciseNameById: (id: string) => string;
  now: Date;
}

function formatGroupKey(key: string, ctx: MessageContext): string {
  const name = ctx.exerciseNameById(key);
  if (name) return name;
  return key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

const DAY_MS = 86_400_000;

/**
 * Builds the ranked insight-chip feed from a computed InsightsBundle.
 * Buckets: PR (≤2) → plateau (≤1) → gap (≤1) → volume; capped at 4 total.
 */
export function generateInsightMessages(
  bundle: InsightsBundle,
  ctx: MessageContext,
): InsightMessage[] {
  const nowMs = ctx.now.getTime();

  // --- Rule A: Personal records within the last 7 days ---
  const recentPrRecords = [...bundle.personalRecords]
    .filter((pr) => nowMs - new Date(pr.workoutDate).getTime() <= 7 * DAY_MS)
    .sort((a, b) => b.workoutDate.localeCompare(a.workoutDate))
    .slice(0, 2);

  const prChips: InsightMessage[] = recentPrRecords.map((pr) => ({
    id: `pr-${pr.exerciseId}-${pr.workoutDate}`,
    severity: 'positive' as const,
    category: 'pr' as const,
    text: `New PR · ${pr.exerciseName} — ${pr.topSetWeight}×${pr.topSetReps} (e1RM ${Math.round(pr.e1rm)} ${pr.weightUnit})`,
    href: `/train/exercises/${pr.exerciseId}`,
  }));

  // Plateau suppression must mirror the chips actually emitted, not every recent PR.
  const prExerciseIds = new Set<string>(recentPrRecords.map((pr) => pr.exerciseId));

  // --- Rule B: Plateau with prescription (skip if exercise already has PR chip) ---
  const latestOrmByExercise = new Map<string, OneRepMaxPoint>();
  for (const point of bundle.oneRepMaxSeries) {
    const existing = latestOrmByExercise.get(point.exerciseId);
    if (!existing || point.workoutDate > existing.workoutDate) {
      latestOrmByExercise.set(point.exerciseId, point);
    }
  }

  const plateauChips: InsightMessage[] = [];
  for (const p of bundle.plateaus) {
    if (!p.isPlateauing) continue;
    if (prExerciseIds.has(p.exerciseId)) continue;
    const latest = latestOrmByExercise.get(p.exerciseId);
    if (!latest) continue;
    plateauChips.push({
      id: `plateau-${p.exerciseId}`,
      severity: 'warning',
      category: 'plateau',
      text: `Plateau · ${p.exerciseName} — stalled ${p.sessionsAnalyzed} sessions at ${latest.topSetWeight}×${latest.topSetReps}. Try drop sets, pause reps, or a deload week.`,
      href: `/train/exercises/${p.exerciseId}`,
    });
    if (plateauChips.length >= 1) break;
  }

  // --- Rule C: Neglected group (≥10 days, must have been trained before) ---
  // Eligibility requires the group to appear at least once in ORM-backed data —
  // bodyweight/zero-weight-only samples surface in lastSeenByGroup but never
  // produce OneRepMaxPoints and must not trigger gap chips.
  const ormTrainedGroups = new Set<string>();
  for (const point of bundle.oneRepMaxSeries) {
    ormTrainedGroups.add(point.muscleGroup);
  }
  const gapCandidates: Array<{ key: string; daysSince: number }> = [];
  for (const [key, lastSeen] of Object.entries(bundle.lastSeenByGroup)) {
    if (!ormTrainedGroups.has(key)) continue;
    const daysSince = Math.floor((nowMs - new Date(lastSeen).getTime()) / DAY_MS);
    if (daysSince >= 10) {
      gapCandidates.push({ key, daysSince });
    }
  }
  gapCandidates.sort((a, b) => b.daysSince - a.daysSince);

  const gapChips: InsightMessage[] = gapCandidates.slice(0, 1).map(({ key, daysSince }) => {
    const formatted = formatGroupKey(key, ctx);
    return {
      id: `gap-${key}`,
      severity: 'warning',
      category: 'gap',
      text: `Gap · ${formatted} — no ${formatted} work in ${daysSince} days`,
      href: '/train',
    };
  });

  // --- Rule D: Volume delta with numbers ---
  const latestVolumeByGroup = new Map<string, VolumeTrendPoint>();
  for (const point of bundle.volumeTrend) {
    const existing = latestVolumeByGroup.get(point.groupKey);
    if (!existing || point.weekStart > existing.weekStart) {
      latestVolumeByGroup.set(point.groupKey, point);
    }
  }

  const volumeCandidates: Array<{ chip: InsightMessage; absPct: number }> = [];
  for (const [groupKey, point] of latestVolumeByGroup) {
    if (point.direction === 'flat') continue;
    if (point.deltaVolume === null) continue;
    if (Math.abs(point.deltaVolume) < 500) continue;
    const prevWeekVolume = point.totalVolume - point.deltaVolume;
    if (prevWeekVolume <= 0) continue;
    const pct = Math.round(Math.abs(point.deltaVolume / prevWeekVolume) * 100);
    const formatted = formatGroupKey(groupKey, ctx);
    const prevStr = Math.round(prevWeekVolume).toLocaleString();
    const currStr = Math.round(point.totalVolume).toLocaleString();
    if (point.direction === 'up') {
      volumeCandidates.push({
        chip: {
          id: `volume-up-${groupKey}`,
          severity: 'positive',
          category: 'volume',
          text: `${formatted} volume +${pct}% vs last week (${prevStr} → ${currStr} lb)`,
          href: '/train',
        },
        absPct: pct,
      });
    } else {
      volumeCandidates.push({
        chip: {
          id: `volume-down-${groupKey}`,
          severity: 'info',
          category: 'volume',
          text: `${formatted} volume −${pct}% vs last week (${prevStr} → ${currStr} lb) — was this planned?`,
          href: '/train',
        },
        absPct: pct,
      });
    }
  }
  volumeCandidates.sort((a, b) => b.absPct - a.absPct);
  const volumeChips = volumeCandidates.map((c) => c.chip);

  // --- Ranking & cap ---
  return [
    ...prChips.slice(0, 2),
    ...plateauChips.slice(0, 1),
    ...gapChips.slice(0, 1),
    ...volumeChips,
  ].slice(0, 4);
}
