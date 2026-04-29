import * as React from 'react';

import { cn } from '@/lib/utils';

interface PageContainerProps {
  title?: string;
  className?: string;
  children: React.ReactNode;
}

export function PageContainer({ title, className, children }: PageContainerProps) {
  return (
    <div
      className={cn(
        'container mx-auto w-full max-w-2xl px-4 py-6 md:max-w-3xl md:px-6 md:py-8',
        className,
      )}
    >
      {title && <h1 className="mb-4 text-2xl font-semibold tracking-tight">{title}</h1>}
      {children}
    </div>
  );
}
