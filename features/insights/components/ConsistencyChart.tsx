'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import type { WorkoutsPerWeekPoint } from '../lib/types';
import { formatWeekLabel } from '../lib/formatters';
import { InsightsEmptyCard } from './InsightsEmptyCard';

interface Props {
  data: WorkoutsPerWeekPoint[];
  targetPerWeek?: number;
}

export function ConsistencyChart({ data, targetPerWeek = 3 }: Props) {
  if (data.length === 0) {
    return <InsightsEmptyCard message="Keep logging to unlock consistency trends" />;
  }

  const chartData = data.map((pt) => ({
    ...pt,
    weekLabel: formatWeekLabel(new Date(`${pt.weekStart}T00:00:00`)),
  }));

  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
        <XAxis
          dataKey="weekLabel"
          tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
          tickLine={false}
          axisLine={false}
          interval="preserveStartEnd"
        />
        <YAxis
          allowDecimals={false}
          tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
          tickLine={false}
          axisLine={false}
          width={24}
        />
        <Tooltip
          formatter={(value: number) => [`${value} workout${value !== 1 ? 's' : ''}`, 'Workouts']}
          labelFormatter={(label) => `Week of ${label}`}
          contentStyle={{
            backgroundColor: 'hsl(var(--card))',
            border: '1px solid hsl(var(--border))',
            borderRadius: '0.5rem',
            fontSize: 12,
          }}
        />
        <ReferenceLine
          y={targetPerWeek}
          stroke="hsl(var(--warning))"
          strokeDasharray="4 4"
          label={{
            value: `Goal: ${targetPerWeek}/wk`,
            position: 'insideTopRight',
            fontSize: 11,
            fill: 'hsl(var(--warning))',
          }}
        />
        <Bar dataKey="count" name="Workouts" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
