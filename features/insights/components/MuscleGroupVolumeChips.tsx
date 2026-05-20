import type { VolumeTrendPoint } from '../lib/types';

interface Props {
  data: VolumeTrendPoint[];
}

function formatGroupKey(key: string): string {
  return key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function latestByGroup(data: VolumeTrendPoint[]): VolumeTrendPoint[] {
  const map = new Map<string, VolumeTrendPoint>();
  for (const pt of data) {
    const existing = map.get(pt.groupKey);
    if (!existing || pt.weekStart > existing.weekStart) map.set(pt.groupKey, pt);
  }
  return [...map.values()].sort((a, b) => a.groupKey.localeCompare(b.groupKey));
}

export function MuscleGroupVolumeChips({ data }: Props) {
  const latest = latestByGroup(data).filter((pt) => pt.deltaVolume !== null);
  if (latest.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {latest.map((pt) => {
        const isUp = pt.direction === 'up';
        const isDown = pt.direction === 'down';
        const delta = Math.round(Math.abs(pt.deltaVolume ?? 0)).toLocaleString();
        return (
          <span
            key={pt.groupKey}
            className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${
              isUp
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                : isDown
                  ? 'border-destructive/30 bg-destructive/10 text-destructive'
                  : 'border-border bg-muted text-muted-foreground'
            }`}
          >
            {isUp ? '+' : isDown ? '−' : ''}
            {delta} {formatGroupKey(pt.groupKey)}
          </span>
        );
      })}
    </div>
  );
}
