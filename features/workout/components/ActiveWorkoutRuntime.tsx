'use client';

import { useActiveWorkoutHydration } from '../hooks/useActiveWorkoutHydration';
import { useConnectivitySync } from '../hooks/useConnectivitySync';
import { ResumeOrDiscardDialog } from './ResumeOrDiscardDialog';

/**
 * Singleton runtime component for the authenticated app shell.
 * Mount exactly once inside AppShell (inside TooltipProvider, outside auth-less pages).
 *
 * Responsibilities:
 * - Runs the server hydration pass on first mount.
 * - Attaches connectivity listeners and drives the flush engine.
 * - Renders the shared ResumeOrDiscardDialog for all workout entry points.
 */
export function ActiveWorkoutRuntime() {
  useActiveWorkoutHydration();
  useConnectivitySync();
  return <ResumeOrDiscardDialog />;
}
