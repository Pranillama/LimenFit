'use client';

import type { LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { cn } from '@/lib/utils';

interface NavItemProps {
  href: string;
  label: string;
  icon: LucideIcon;
  variant: 'sidebar' | 'mobile';
}

export function NavItem({ href, label, icon: Icon, variant }: NavItemProps) {
  const pathname = usePathname();
  const isActive = pathname === href || pathname.startsWith(href + '/');

  if (variant === 'sidebar') {
    return (
      <Link
        href={href}
        aria-current={isActive ? 'page' : undefined}
        className={cn(
          'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground',
          isActive && 'bg-accent text-brand',
        )}
      >
        <Icon className={cn('h-4 w-4 shrink-0', isActive && 'text-brand')} />
        {label}
      </Link>
    );
  }

  return (
    <Link
      href={href}
      aria-current={isActive ? 'page' : undefined}
      className={cn(
        'flex min-h-[48px] flex-1 flex-col items-center justify-center gap-1 text-xs font-medium transition-colors hover:bg-accent hover:text-accent-foreground',
        isActive && 'text-brand',
      )}
    >
      <Icon className={cn('h-5 w-5 shrink-0', isActive && 'text-brand')} />
      {label}
    </Link>
  );
}
