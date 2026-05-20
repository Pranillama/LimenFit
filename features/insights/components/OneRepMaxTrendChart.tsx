'use client';

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import type { OneRepMaxPoint, WeightUnit } from '../lib/types';
import { InsightsEmptyCard } from './InsightsEmptyCard';

export interface OneRepMaxTrendChartProps {
  points: OneRepMaxPoint[];
  unit: WeightUnit;
}

function formatDateShort(isoString: string): string {
  return new Date(isoString).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function formatE1rm(value: number, unit: WeightUnit): string {
  return `${Math.round(value)} ${unit}`;
}

export function OneRepMaxTrendChart({ points, unit }: OneRepMaxTrendChartProps) {
  if (points.length < 2) {
    return <InsightsEmptyCard message="Log at least 2 sessions of this exercise to see a trend" />;
  }

  const rows = points.map((p) => ({
    dateLabel: formatDateShort(p.workoutDate),
    workoutDate: p.workoutDate,
    e1rm: Math.round(p.e1rm * 10) / 10,
  }));

  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={rows} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis
          dataKey="dateLabel"
          tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
          tickLine={false}
          axisLine={false}
          interval="preserveStartEnd"
        />
        <YAxis
          tickFormatter={(v: number) => formatE1rm(v, unit)}
          tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
          tickLine={false}
          axisLine={false}
          width={76}
        />
        <Tooltip
          formatter={(value: number) => [formatE1rm(value, unit), 'Est. 1RM']}
          labelFormatter={(label, payload) => {
            const date = payload?.[0]?.payload?.workoutDate;
            return date ? formatDateShort(date) : label;
          }}
          contentStyle={{
            backgroundColor: 'hsl(var(--card))',
            border: '1px solid hsl(var(--border))',
            borderRadius: '0.5rem',
            fontSize: 12,
          }}
        />
        <Line
          type="monotone"
          dataKey="e1rm"
          name="Est. 1RM"
          stroke="hsl(var(--primary))"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
