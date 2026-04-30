'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  subscribeResumeRequest,
  settleRequest,
  type StartIntent,
} from '../store/resumeCoordinator';

function discardLabel(source: StartIntent['source']): string {
  switch (source) {
    case 'plan':
      return 'Discard current workout and start the selected plan workout';
    case 'history':
    case 'history-restore':
      return 'Discard current workout and start the selected workout';
    case 'home':
    case 'freestyle':
    default:
      return 'Discard current workout and start a new one';
  }
}

/**
 * Mount once inside AppShell so every entry point (T10/T12/T14) shares a single
 * dialog instance. Wording follows spec:Core Flows — LimenFit Phase 1, Flow 3 step 1.
 */
export function ResumeOrDiscardDialog() {
  const [open, setOpen] = useState(false);
  const [intent, setIntent] = useState<StartIntent | null>(null);

  useEffect(() => {
    return subscribeResumeRequest(({ intent: incoming }) => {
      setIntent(incoming);
      setOpen(true);
    });
  }, []);

  function handleResume() {
    setOpen(false);
    settleRequest('resume');
  }

  function handleDiscardAndStart() {
    setOpen(false);
    settleRequest('discard-and-start');
  }

  function handleCancel() {
    setOpen(false);
    settleRequest('cancel');
  }

  // Treat overlay / Esc dismissal as Cancel so the promise always resolves.
  function handleOpenChange(next: boolean) {
    if (!next) handleCancel();
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent hideCloseButton>
        <DialogHeader>
          <DialogTitle>You have an active workout</DialogTitle>
        </DialogHeader>
        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <Button onClick={handleResume}>Resume current workout</Button>
          <Button variant="destructive" onClick={handleDiscardAndStart}>
            {intent ? discardLabel(intent.source) : 'Discard current workout and start a new one'}
          </Button>
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
