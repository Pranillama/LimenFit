'use client';

import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/sonner';
import { newClientMutationId } from '@/lib/idempotency';

import { useDuplicatePlanMutation } from '../hooks/useDuplicatePlanMutation';
import { setPendingDuplicate } from '../lib/pendingDuplicate';

interface DuplicatePlanButtonProps {
  shareSlug: string;
  viewerIsLoggedIn: boolean;
}

export function DuplicatePlanButton({
  shareSlug,
  viewerIsLoggedIn,
}: DuplicatePlanButtonProps) {
  const router = useRouter();
  const mutation = useDuplicatePlanMutation();

  const handleClick = () => {
    const clientMutationId = newClientMutationId();

    if (!viewerIsLoggedIn) {
      setPendingDuplicate({ shareSlug, clientMutationId, createdAt: Date.now() });
      router.push('/auth?next=/train/plans');
      return;
    }

    mutation.mutate(
      { shareSlug, clientMutationId },
      {
        onSuccess: (plan) => {
          toast.success('Plan added to your library!');
          router.push(`/train/plans/${plan.id}`);
        },
        onError: () => {
          toast.error('Failed to duplicate plan');
        },
      },
    );
  };

  return (
    <Button onClick={handleClick} disabled={mutation.isPending}>
      {mutation.isPending ? 'Duplicating…' : 'Add to my library'}
    </Button>
  );
}
