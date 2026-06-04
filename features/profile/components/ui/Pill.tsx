import * as React from 'react';

import { cn } from '@/lib/utils';

type Tone = 'neutral' | 'brand' | 'success' | 'danger';

interface PillProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
}

const TONE_CLASS: Record<Tone, string> = {
  neutral: 'border-border bg-secondary text-foreground',
  brand: 'border-brand/30 bg-brand/10 text-brand',
  success: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400',
  danger: 'border-destructive/30 bg-destructive/10 text-destructive',
};

export function Pill({ tone = 'neutral', className, ...rest }: PillProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium',
        TONE_CLASS[tone],
        className,
      )}
      {...rest}
    />
  );
}
