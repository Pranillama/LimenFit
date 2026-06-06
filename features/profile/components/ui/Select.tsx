'use client';

import { Check, ChevronDown } from 'lucide-react';
import * as React from 'react';

import { cn } from '@/lib/utils';

export interface SelectOption<T extends string> {
  value: T;
  label: string;
}

interface SelectProps<T extends string> {
  options: SelectOption<T>[];
  value: T | null;
  onChange: (next: T | null) => void;
  placeholder?: string;
  ariaLabel?: string;
  id?: string;
  className?: string;
}

/**
 * A controlled dropdown that anchors its menu directly beneath the trigger.
 * Built in-house (rather than a native <select>) so menu positioning is
 * consistent across mobile and desktop. Closes on outside click or Escape.
 */
export function Select<T extends string>({
  options,
  value,
  onChange,
  placeholder = 'Select…',
  ariaLabel,
  id,
  className,
}: SelectProps<T>) {
  const [open, setOpen] = React.useState(false);
  const rootRef = React.useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.value === value) ?? null;

  React.useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      <button
        type="button"
        id={id}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-1',
          'text-left text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
        )}
      >
        <span className={cn(selected ? 'text-foreground' : 'text-muted-foreground')}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
      </button>

      {open ? (
        <ul
          role="listbox"
          aria-label={ariaLabel}
          className={cn(
            'absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border border-border bg-card p-1 shadow-md',
          )}
        >
          {options.map((opt) => {
            const active = opt.value === value;
            return (
              <li key={opt.value}>
                <button
                  type="button"
                  role="option"
                  aria-selected={active}
                  onClick={() => {
                    onChange(opt.value);
                    setOpen(false);
                  }}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-[0.3rem] px-3 py-2 text-left text-sm transition-colors',
                    'hover:bg-accent focus-visible:bg-accent focus-visible:outline-none',
                    active ? 'text-foreground' : 'text-muted-foreground',
                  )}
                >
                  <Check className={cn('h-4 w-4 shrink-0', active ? 'opacity-100' : 'opacity-0')} />
                  {opt.label}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
