'use client';

import * as React from 'react';

/**
 * Returns a `Date.now()` value that ticks every second.
 * Pauses when the tab is hidden to avoid unnecessary work.
 */
export function useNow(): number {
  const [now, setNow] = React.useState(() => Date.now());

  React.useEffect(() => {
    let timerId: ReturnType<typeof setInterval> | null = null;

    function start() {
      setNow(Date.now());
      timerId = setInterval(() => setNow(Date.now()), 1000);
    }

    function stop() {
      if (timerId !== null) {
        clearInterval(timerId);
        timerId = null;
      }
    }

    function handleVisibilityChange() {
      if (document.visibilityState === 'hidden') {
        stop();
      } else {
        start();
      }
    }

    if (document.visibilityState !== 'hidden') {
      start();
    }

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      stop();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  return now;
}
