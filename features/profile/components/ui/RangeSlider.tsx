'use client';

import * as React from 'react';

import { cn } from '@/lib/utils';

interface RangeSliderProps {
  min: number;
  max: number;
  step?: number;
  value: number;
  onChange: (next: number) => void;
  ariaLabel?: string;
  /** Rendered to the right of the track, e.g. "4 days/wk". */
  valueLabel?: React.ReactNode;
  className?: string;
}

/**
 * A brand-styled range input. Filled portion of the track is brand orange up to
 * the thumb; the thumb is a brand dot. Track fill is driven by a CSS gradient so
 * it works without JS measurement.
 */
export function RangeSlider({
  min,
  max,
  step = 1,
  value,
  onChange,
  ariaLabel,
  valueLabel,
  className,
}: RangeSliderProps) {
  const pct = max > min ? ((value - min) / (max - min)) * 100 : 0;

  return (
    <div className={cn('flex items-center gap-4', className)}>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-label={ariaLabel}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{
          background: `linear-gradient(to right, #e85500 0%, #e85500 ${pct}%, hsl(var(--secondary)) ${pct}%, hsl(var(--secondary)) 100%)`,
        }}
        className={cn(
          'h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-secondary outline-none',
          // WebKit thumb
          '[&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none',
          '[&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-background',
          '[&::-webkit-slider-thumb]:bg-brand [&::-webkit-slider-thumb]:shadow',
          'focus-visible:[&::-webkit-slider-thumb]:ring-2 focus-visible:[&::-webkit-slider-thumb]:ring-ring',
          // Firefox thumb
          '[&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:rounded-full',
          '[&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-background [&::-moz-range-thumb]:bg-brand',
        )}
      />
      {valueLabel != null ? (
        <span className="shrink-0 text-sm font-semibold tabular-nums">{valueLabel}</span>
      ) : null}
    </div>
  );
}
