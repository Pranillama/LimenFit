'use client';

import { Trash2 } from 'lucide-react';
import * as React from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

import { useDeleteAccount } from '../hooks/useDeleteAccount';

export function DeleteAccountDialog() {
  const { deleteAccount, isDeleting } = useDeleteAccount();
  const [open, setOpen] = React.useState(false);
  const [confirm, setConfirm] = React.useState('');

  const canConfirm = confirm === 'DELETE' && !isDeleting;

  React.useEffect(() => {
    if (!open) setConfirm('');
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="flex w-full min-h-[3.25rem] items-center gap-3 rounded-xl border border-destructive/25 bg-card px-4 py-3 text-left transition-colors hover:bg-destructive/10 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-destructive"
        >
          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-destructive/30 bg-destructive/10 text-destructive">
            <Trash2 className="h-4 w-4" />
          </span>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-sm font-medium text-destructive">Delete account</span>
            <span className="truncate text-xs text-muted-foreground">This action cannot be undone</span>
          </span>
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete your account?</DialogTitle>
          <DialogDescription>
            This permanently deletes your account, workouts, plans, and all related data. This cannot be undone.
            Type <span className="font-mono font-semibold text-foreground">DELETE</span> to confirm.
          </DialogDescription>
        </DialogHeader>
        <Input
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="Type DELETE"
          autoComplete="off"
          aria-label="Type DELETE to confirm"
        />
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={isDeleting}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={!canConfirm}
            onClick={() => void deleteAccount()}
          >
            {isDeleting ? 'Deleting…' : 'Delete account'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
