import Link from 'next/link';
import {
  Activity,
  ChevronRight,
  PauseCircle,
  TrendingDown,
  TrendingUp,
  Trophy,
} from 'lucide-react';

import type { InsightMessage } from '@/features/insights/lib/types';
import { InsightsEmptyCard } from '@/features/insights/components/InsightsEmptyCard';

interface Props {
  messages: InsightMessage[];
  hasEnoughData: boolean;
}

const categoryIconMap = {
  pr: Trophy,
  plateau: PauseCircle,
  gap: TrendingDown,
  volume: TrendingUp,
  consistency: Activity,
} as const;

export function InsightsList({ messages, hasEnoughData }: Props) {
  if (!hasEnoughData) {
    return <InsightsEmptyCard />;
  }

  return (
    <div className="space-y-2">
      {messages.map((msg) => {
        const Icon =
          msg.category === 'volume' && msg.severity === 'info'
            ? Activity
            : categoryIconMap[msg.category];
        const baseClass = 'flex items-start gap-3 rounded-lg border bg-card p-4';

        if (msg.href) {
          return (
            <Link
              key={msg.id}
              href={msg.href}
              className={`${baseClass} transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring`}
            >
              <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <p className="flex-1 text-sm">{msg.text}</p>
              <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            </Link>
          );
        }

        return (
          <div key={msg.id} className={baseClass}>
            <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <p className="flex-1 text-sm">{msg.text}</p>
          </div>
        );
      })}
    </div>
  );
}
