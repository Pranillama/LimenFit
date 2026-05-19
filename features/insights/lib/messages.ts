import type { InsightMessage, InsightsBundle, VolumeTrendPoint } from './types';

interface MessageContext {
  /** Resolves an exerciseId to its display name. Returns empty string when unknown. */
  exerciseNameById: (id: string) => string;
}

/** Capitalizes a snake_case key for display (e.g. "full_body" → "Full Body"). */
function formatGroupKey(key: string, ctx: MessageContext): string {
  const name = ctx.exerciseNameById(key);
  if (name) return name;
  return key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Generates human-readable insight messages from a computed InsightsBundle.
 *
 * Messages are plain prose — no raw coefficients or formula outputs. The
 * function is deterministic: the same bundle always produces the same messages
 * in the same order.
 */
export function generateInsightMessages(
  bundle: InsightsBundle,
  ctx: MessageContext,
): InsightMessage[] {
  const messages: InsightMessage[] = [];

  // --- Plateau warnings ---
  for (const p of bundle.plateaus) {
    if (!p.isPlateauing) continue;
    messages.push({
      id: `plateau-${p.exerciseId}`,
      severity: 'warning',
      text: `${p.exerciseName} has been flat for ${p.sessionsAnalyzed} sessions — try varying rep range or adding a deload week.`,
    });
  }

  // --- Consistency messages ---
  const { avgWorkoutsPerWeek, streakWeeks } = bundle.consistency;

  if (streakWeeks >= 4) {
    messages.push({
      id: 'consistency-streak-strong',
      severity: 'positive',
      text: `You've hit your training target ${streakWeeks} weeks in a row — outstanding consistency.`,
    });
  } else if (streakWeeks >= 2) {
    messages.push({
      id: 'consistency-streak',
      severity: 'positive',
      text: `You've met your weekly training goal ${streakWeeks} weeks running — keep it up.`,
    });
  } else if (avgWorkoutsPerWeek > 0 && avgWorkoutsPerWeek < 1) {
    messages.push({
      id: 'consistency-low',
      severity: 'warning',
      text: `Your training frequency has dipped below one session per week — even a short workout helps you stay on track.`,
    });
  } else if (avgWorkoutsPerWeek > 0 && avgWorkoutsPerWeek < 2) {
    messages.push({
      id: 'consistency-moderate-low',
      severity: 'info',
      text: `You're averaging fewer than two sessions per week — adding one more day could accelerate your progress.`,
    });
  }

  // --- Volume trend messages (most recent week per group key only) ---
  const latestByGroup = new Map<string, VolumeTrendPoint>();
  for (const point of bundle.volumeTrend) {
    const existing = latestByGroup.get(point.groupKey);
    if (!existing || point.weekStart > existing.weekStart) {
      latestByGroup.set(point.groupKey, point);
    }
  }

  for (const [groupKey, point] of latestByGroup) {
    const name = formatGroupKey(groupKey, ctx);

    if (point.direction === 'up') {
      messages.push({
        id: `volume-up-${groupKey}`,
        severity: 'positive',
        text: `Volume for ${name} is trending up this week — great momentum.`,
      });
    } else if (point.direction === 'down' && point.deltaVolume !== null) {
      messages.push({
        id: `volume-down-${groupKey}`,
        severity: 'info',
        text: `Volume for ${name} dipped this week — that's fine if you planned a lighter session.`,
      });
    }
  }

  return messages;
}
