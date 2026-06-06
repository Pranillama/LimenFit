'use client';

import type { LucideIcon } from 'lucide-react';
import * as React from 'react';

import { cn } from '@/lib/utils';

export interface GoalOption<T extends string> {
  value: T;
  label: string;
  icon: LucideIcon;
}

interface GoalGridProps<T extends string> {
  options: GoalOption<T>[];
  value: T | null;
  onChange: (next: T | null) => void;
  ariaLabel?: string;
  className?: string;
}

/**
 * A grid of tappable icon cards for single-select. Clicking the active card
 * clears the selection (matches the nullable Gender pattern). Two columns on
 * mobile, three on wide screens.
 */
export function GoalGrid<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  className,
}: GoalGridProps<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn('grid grid-cols-2 gap-3 lg:grid-cols-3', className)}
    >
      {options.map(({ value: optValue, label, icon: Icon }) => {
        const active = optValue === value;
        return (
          <button
            key={optValue}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(active ? null : optValue)}
            className={cn(
              'flex items-center gap-2 rounded-lg border px-4 py-3 text-left text-sm font-medium transition-colors',
              active
                ? 'border-brand/60 bg-brand/10 text-foreground'
                : 'border-border bg-card text-muted-foreground hover:text-foreground',
            )}
          >
            <Icon
              className={cn('h-4 w-4 shrink-0', active ? 'text-brand' : 'text-muted-foreground')}
            />
            {label}
          </button>
        );
      })}
    </div>
  );
}
