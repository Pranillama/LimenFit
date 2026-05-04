'use client';

import * as React from 'react';

import { restRemaining } from '../lib/restTimer';
import { useActiveWorkoutStore } from '../store/useActiveWorkoutStore';

interface RestTimerProps {
  exerciseLocalId: string;
  now: number;
}

export function RestTimer({ exerciseLocalId, now }: RestTimerProps) {
  const entry = useActiveWorkoutStore(
    React.useCallback((s) => s.restTimer[exerciseLocalId] ?? null, [exerciseLocalId]),
  );

  const remaining = entry ? restRemaining(entry, now) : 0;

  // Guard: fire clearance exactly once per timer expiry.
  const firedRef = React.useRef(false);

  React.useEffect(() => {
    if (entry && remaining <= 0 && !firedRef.current) {
      firedRef.current = true;
      useActiveWorkoutStore.getState().setRestTimer(exerciseLocalId, null);
    }
    if (!entry) {
      firedRef.current = false;
    }
  }, [entry, remaining, exerciseLocalId]);

  if (!entry || remaining <= 0) return null;

  const mins = Math.floor(remaining / 60);
  const secs = Math.floor(remaining % 60);
  const formatted = `${mins}:${secs.toString().padStart(2, '0')}`;

  return (
    <div className="mx-3 mb-2 flex items-center gap-1.5 rounded-md bg-warning/10 px-2.5 py-1 text-sm text-warning">
      <span aria-hidden>⏳</span>
      <span>Rest: {formatted} remaining</span>
    </div>
  );
}
