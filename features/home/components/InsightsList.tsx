import { Activity, Minus, TrendingUp } from 'lucide-react';

import type { InsightMessage } from '@/features/insights/lib/types';
import { InsightsEmptyCard } from '@/features/insights/components/InsightsEmptyCard';

interface Props {
  messages: InsightMessage[];
  hasEnoughData: boolean;
}

const iconMap = {
  positive: TrendingUp,
  warning: Minus,
  info: Activity,
} as const;

export function InsightsList({ messages, hasEnoughData }: Props) {
  if (!hasEnoughData) {
    return <InsightsEmptyCard />;
  }

  return (
    <div className="space-y-2">
      {messages.map((msg) => {
        const Icon = iconMap[msg.severity];
        return (
          <div key={msg.id} className="flex items-start gap-3 rounded-lg border bg-card p-4">
            <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <p className="text-sm">{msg.text}</p>
          </div>
        );
      })}
    </div>
  );
}
