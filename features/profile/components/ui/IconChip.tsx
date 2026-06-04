import * as React from 'react';
import type { LucideIcon } from 'lucide-react';

import { cn } from '@/lib/utils';

interface IconChipProps {
  icon: LucideIcon;
  active?: boolean;
  className?: string;
  ariaHidden?: boolean;
}

export function IconChip({
  icon: Icon,
  active = false,
  className,
  ariaHidden = true,
}: IconChipProps) {
  return (
    <span
      aria-hidden={ariaHidden}
      className={cn(
        'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border transition-colors',
        active
          ? 'border-brand/30 bg-brand/10 text-brand'
          : 'border-border bg-secondary text-muted-foreground',
        className,
      )}
    >
      <Icon className="h-4 w-4" />
    </span>
  );
}
