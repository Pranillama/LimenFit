'use client';

// Recharts conventions for this codebase:
// - Always wrap in <ResponsiveContainer width="100%" height={N}>
// - Colors via stroke="hsl(var(--primary))" etc. so charts inherit the light/dark theme
// - X-axis week labels via formatWeekLabel() from features/insights/lib/formatters
// - Insufficient-data state: render the empty card pattern, never a broken chart

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import type { VolumeTrendPoint } from '../lib/types';
import { formatVolume, formatWeekLabel } from '../lib/formatters';
import { InsightsEmptyCard } from './InsightsEmptyCard';

// Palette of 6 distinct hues that survive both light and dark themes.
// The first entry uses --primary so it always matches the brand accent.
const COLORS = [
  'hsl(var(--primary))',
  '#60a5fa', // blue-400
  '#34d399', // emerald-400
  '#f59e0b', // amber-500
  '#f87171', // red-400
  '#a78bfa', // violet-400
];

export interface VolumeTrendChartProps {
  data: VolumeTrendPoint[];
  groupBy: 'muscleGroup' | 'exerciseId';
  unit: 'lbs' | 'kg';
}

interface ChartRow {
  weekStart: string;
  weekLabel: string;
  [groupKey: string]: string | number;
}

function buildChartRows(data: VolumeTrendPoint[]): { rows: ChartRow[]; groupKeys: string[] } {
  const weekMap = new Map<string, Record<string, number>>();
  const allGroupKeys = new Set<string>();

  for (const pt of data) {
    if (!weekMap.has(pt.weekStart)) weekMap.set(pt.weekStart, {});
    weekMap.get(pt.weekStart)![pt.groupKey] = pt.totalVolume;
    allGroupKeys.add(pt.groupKey);
  }

  const rows: ChartRow[] = [...weekMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([weekStart, volumes]) => ({
      weekStart,
      weekLabel: formatWeekLabel(new Date(`${weekStart}T00:00:00`)),
      ...volumes,
    }));

  return { rows, groupKeys: [...allGroupKeys].sort() };
}

function formatGroupKey(key: string): string {
  return key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function VolumeTrendChart({ data, unit }: VolumeTrendChartProps) {
  if (data.length === 0) {
    return <InsightsEmptyCard message="Keep logging to unlock volume trends" />;
  }

  const { rows, groupKeys } = buildChartRows(data);

  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={rows} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis
          dataKey="weekLabel"
          tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
          tickLine={false}
          axisLine={false}
          interval="preserveStartEnd"
        />
        <YAxis
          tickFormatter={(v: number) => formatVolume(v, unit)}
          tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
          tickLine={false}
          axisLine={false}
          width={76}
        />
        <Tooltip
          formatter={(value: number) => [formatVolume(value, unit), undefined]}
          labelFormatter={(label) => `Week of ${label}`}
          contentStyle={{
            backgroundColor: 'hsl(var(--card))',
            border: '1px solid hsl(var(--border))',
            borderRadius: '0.5rem',
            fontSize: 12,
          }}
        />
        {groupKeys.length > 1 && (
          <Legend formatter={formatGroupKey} wrapperStyle={{ fontSize: 12 }} />
        )}
        {groupKeys.map((key, i) => (
          <Line
            key={key}
            type="monotone"
            dataKey={key}
            name={formatGroupKey(key)}
            stroke={COLORS[i % COLORS.length]}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
