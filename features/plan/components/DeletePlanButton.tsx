'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { DiscardConfirmationDialog } from '@/components/discard-confirmation-dialog';
import { useDeletePlanMutation } from '../hooks/useDeletePlanMutation';

interface Props {
  planId: string;
}

export function DeletePlanButton({ planId }: Props) {
  const [open, setOpen] = React.useState(false);
  const router = useRouter();
  const deletePlan = useDeletePlanMutation();

  function handleDiscard() {
    setOpen(false);
    deletePlan.mutate(
      { id: planId },
      {
        onSuccess: () => {
          router.push('/train/plans');
          router.refresh();
        },
      },
    );
  }

  return (
    <>
      <Button
        variant="destructive"
        size="sm"
        onClick={() => setOpen(true)}
        disabled={deletePlan.isPending}
      >
        Delete
      </Button>
      <DiscardConfirmationDialog
        open={open}
        onOpenChange={setOpen}
        title="Delete this plan?"
        description="This cannot be undone."
        discardLabel="Delete"
        keepEditingLabel="Cancel"
        onDiscard={handleDiscard}
      />
    </>
  );
}
