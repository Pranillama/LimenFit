import { cn } from '@/lib/utils';

export interface AvatarProps {
  avatarUrl: string | null;
  initials: string;
  /** Rendered width/height in px. Default 56. */
  size?: number;
  className?: string;
}

/**
 * Presentational avatar: shows the image when present, else an initials circle.
 * Square source images crop cleanly into this round frame at any size, so the
 * same component is reusable in headers, nav, author chips, etc.
 */
export function Avatar({ avatarUrl, initials, size = 56, className }: AvatarProps) {
  const dimension = { width: size, height: size };

  if (avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={avatarUrl}
        alt=""
        style={dimension}
        className={cn('rounded-full object-cover', className)}
      />
    );
  }

  return (
    <div
      style={dimension}
      className={cn(
        'flex items-center justify-center rounded-full bg-secondary font-semibold text-foreground',
        className,
      )}
    >
      <span style={{ fontSize: Math.round(size * 0.36) }}>{initials}</span>
    </div>
  );
}
