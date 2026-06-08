import { Check, Sparkles } from 'lucide-react';

import { Button } from '@/components/ui/button';

const PRO_FEATURES = [
  'Higher daily AI limit',
  'Form analysis from video',
  'Advanced progression insights & exports',
  'Plan sharing',
];

export interface SubscriptionViewProps {
  aiUsedToday: number;
  aiCap: number;
  workoutsThisMonth: number;
  savedPlans: number;
}

export function SubscriptionView({
  aiUsedToday,
  aiCap,
  workoutsThisMonth,
  savedPlans,
}: SubscriptionViewProps) {
  const aiPct = aiCap > 0 ? Math.min(100, Math.max(0, (aiUsedToday / aiCap) * 100)) : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Subscription</h1>
        <p className="mt-1 text-sm text-muted-foreground">Your plan and what&rsquo;s included.</p>
      </div>

      {/* Plan card */}
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-2xl font-bold">Free</span>
              <span className="whitespace-nowrap rounded-full bg-secondary px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Current plan
              </span>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              Core logging, offline sync, and limited AI. No card on file.
            </p>
          </div>
          <Button type="button" variant="secondary" disabled className="w-full shrink-0 sm:w-auto">
            <Sparkles className="mr-2 h-4 w-4" />
            Upgrade soon
          </Button>
        </div>
      </div>

      {/* AI usage */}
      <div className="rounded-xl border border-border bg-card p-6">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          AI assistant
        </p>
        <div className="mt-4 flex items-baseline justify-between">
          <span className="text-sm font-medium">Tokens used today</span>
          <span className="text-sm tabular-nums text-muted-foreground">
            {aiUsedToday.toLocaleString()} / {aiCap.toLocaleString()}
          </span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-secondary">
          <div className="h-full rounded-full bg-foreground/80" style={{ width: `${aiPct}%` }} />
        </div>
        <p className="mt-2 text-xs text-muted-foreground">Resets daily at midnight (UTC).</p>
      </div>

      {/* Activity */}
      <div className="rounded-xl border border-border bg-card p-6">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Your activity
        </p>
        <div className="mt-4 grid grid-cols-2 gap-4">
          <div className="rounded-lg border border-border bg-background/40 p-4">
            <p className="text-2xl font-bold tabular-nums">{workoutsThisMonth.toLocaleString()}</p>
            <p className="mt-1 text-xs text-muted-foreground">Workouts this month</p>
          </div>
          <div className="rounded-lg border border-border bg-background/40 p-4">
            <p className="text-2xl font-bold tabular-nums">{savedPlans.toLocaleString()}</p>
            <p className="mt-1 text-xs text-muted-foreground">Saved plans</p>
          </div>
        </div>
      </div>

      {/* Pro features */}
      <div className="rounded-xl border border-border bg-card p-6">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Pro features
        </p>
        <ul className="mt-4 space-y-3">
          {PRO_FEATURES.map((feature) => (
            <li key={feature} className="flex items-center gap-3 text-sm">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground">
                <Check className="h-3 w-3" />
              </span>
              {feature}
            </li>
          ))}
        </ul>
        <p className="mt-5 border-t border-border pt-4 text-xs text-muted-foreground">
          Pricing isn&rsquo;t live yet. You&rsquo;ll be able to upgrade here when plans launch.
        </p>
      </div>
    </div>
  );
}
