'use client';

import { LogOut } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useHardenedSignOut } from '@/features/shell/useHardenedSignOut';

export function SignOutButton() {
  const { handleSignOut, isPending } = useHardenedSignOut();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={isPending}
        className="flex w-full items-center justify-center gap-2 rounded-md bg-destructive px-4 py-3 text-sm font-medium text-destructive-foreground transition-colors hover:bg-destructive/90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-destructive disabled:opacity-50"
      >
        <LogOut className="h-4 w-4" />
        {isPending ? 'Signing out…' : 'Sign out'}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent hideCloseButton className="w-full max-w-sm rounded-xl">
          <DialogHeader className="text-left">
            <DialogTitle>Sign out of LimenFit?</DialogTitle>
            <DialogDescription>
              You can sign back in anytime. Your offline data stays on this device.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-row justify-end gap-2 sm:flex-row">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                setOpen(false);
                handleSignOut();
              }}
              disabled={isPending}
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
