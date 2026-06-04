'use client';

import Link from 'next/link';
import { ChevronRight, type LucideIcon } from 'lucide-react';
import * as React from 'react';

import { cn } from '@/lib/utils';

import { IconChip } from './IconChip';

interface SectionRowProps {
  icon: LucideIcon;
  label: string;
  sublabel?: string;
  href?: string;
  onSelect?: () => void;
  active?: boolean;
  trailing?: React.ReactNode;
  className?: string;
}

export function SectionRow({
  icon,
  label,
  sublabel,
  href,
  onSelect,
  active = false,
  trailing,
  className,
}: SectionRowProps) {
  const content = (
    <>
      <IconChip icon={icon} active={active} />
      <span className="flex min-w-0 flex-1 flex-col text-left">
        <span className="truncate text-sm font-medium text-foreground">{label}</span>
        {sublabel ? (
          <span className="truncate text-xs text-muted-foreground">{sublabel}</span>
        ) : null}
      </span>
      {trailing ?? (
        <ChevronRight
          className={cn('h-4 w-4 shrink-0', active ? 'text-brand' : 'text-muted-foreground')}
        />
      )}
    </>
  );

  const classes = cn(
    'flex w-full min-h-[3.25rem] items-center gap-3 rounded-lg border border-transparent px-3 py-2 transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
    active && 'bg-accent',
    className,
  );

  if (href) {
    return (
      <Link href={href} className={classes} aria-current={active ? 'page' : undefined}>
        {content}
      </Link>
    );
  }

  return (
    <button type="button" onClick={onSelect} className={classes}>
      {content}
    </button>
  );
}
