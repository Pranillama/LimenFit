'use client';

import * as React from 'react';

import { useNow } from '@/features/workout/hooks/useNow';

const dateFormat = new Intl.DateTimeFormat(undefined, {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
});

function greeting(hour: number): string {
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

export function HomeGreeting() {
  const nowMs = useNow();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const date = new Date(nowMs);
  const greetingText = mounted ? greeting(date.getHours()) : '';
  const dateText = mounted ? dateFormat.format(date) : '';

  return (
    <div>
      <h1 className="text-2xl font-semibold">{greetingText}</h1>
      <p className="mt-0.5 text-sm text-muted-foreground">{dateText}</p>
    </div>
  );
}
