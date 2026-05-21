import { Search } from 'lucide-react';

import { cn } from '@/lib/utils';

export function summarizeToolCall(name: string, args: unknown): string {
  if (!args || typeof args !== 'object') {
    return defaultSummary(name);
  }
  const obj = args as Record<string, unknown>;
  const exercise = typeof obj.exercise === 'string' ? obj.exercise : null;
  switch (name) {
    case 'get_exercise_history':
      return exercise ? `Looked up ${exercise} history` : 'Looked up exercise history';
    case 'search_sets_by_criteria':
      return exercise ? `Searched ${exercise} sets` : 'Searched set history';
    case 'get_personal_records':
      return exercise ? `Checked ${exercise} PRs` : 'Checked personal records';
    case 'get_recent_workouts':
      return 'Reviewed recent workouts';
    default:
      return defaultSummary(name);
  }
}

function defaultSummary(name: string): string {
  return name.replace(/_/g, ' ');
}

interface ToolCallIndicatorProps {
  summary: string;
  className?: string;
}

export function ToolCallIndicator({ summary, className }: ToolCallIndicatorProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border bg-muted/40 px-2.5 py-1 text-xs text-muted-foreground',
        className,
      )}
    >
      <Search className="h-3 w-3 shrink-0" aria-hidden="true" />
      <span>{summary}…</span>
    </span>
  );
}
