'use client';

import * as React from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export interface DiscardConfirmationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  discardLabel?: string;
  keepEditingLabel?: string;
  onDiscard: () => void;
}

export function DiscardConfirmationDialog({
  open,
  onOpenChange,
  title = 'Discard changes?',
  description = 'Any unsaved changes will be lost.',
  discardLabel = 'Discard',
  keepEditingLabel = 'Keep Editing',
  onDiscard,
}: DiscardConfirmationDialogProps) {
  const keepEditingRef = React.useRef<HTMLButtonElement>(null);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        hideCloseButton
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          keepEditingRef.current?.focus();
        }}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="destructive" onClick={onDiscard}>
            {discardLabel}
          </Button>
          <Button ref={keepEditingRef} onClick={() => onOpenChange(false)}>
            {keepEditingLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
