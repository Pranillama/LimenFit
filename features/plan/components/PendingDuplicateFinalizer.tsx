'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

import { toast } from '@/components/ui/sonner';
import { useDuplicatePlanMutation, ApiError } from '../hooks/useDuplicatePlanMutation';
import {
  getPendingDuplicate,
  clearPendingDuplicate,
} from '../lib/pendingDuplicate';

export function PendingDuplicateFinalizer() {
  const router = useRouter();
  const duplicatePlan = useDuplicatePlanMutation();
  const firedRef = React.useRef(false);

  React.useEffect(() => {
    if (firedRef.current) return;

    const pending = getPendingDuplicate();
    if (!pending) return;

    firedRef.current = true;

    duplicatePlan.mutate(
      { shareSlug: pending.shareSlug, clientMutationId: pending.clientMutationId },
      {
        onSuccess: (plan) => {
          clearPendingDuplicate();
          toast.success('Plan added to your library!');
          router.push(`/train/plans/${plan.id}`);
          router.refresh();
        },
        onError: (err) => {
          const isNotFound =
            err instanceof ApiError && (err.status === 404 || err.code === 'NOT_FOUND');
          if (isNotFound) {
            clearPendingDuplicate();
            toast.error('That plan is no longer available.');
          } else {
            // Leave pending duplicate intact so the same idempotency key can retry.
            toast.error('Could not add plan — please try again.');
          }
        },
      },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
