// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, waitFor, act, cleanup } from '@testing-library/react';

vi.mock('../../hooks/useDuplicatePlanMutation', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../hooks/useDuplicatePlanMutation')>();
  return { ...actual, useDuplicatePlanMutation: vi.fn() };
});

vi.mock('@/components/ui/sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
}));

import { PendingDuplicateFinalizer } from '../PendingDuplicateFinalizer';
import { useDuplicatePlanMutation, ApiError } from '../../hooks/useDuplicatePlanMutation';
import { toast } from '@/components/ui/sonner';
import { useRouter } from 'next/navigation';
import {
  PENDING_DUPLICATE_KEY,
  PENDING_DUPLICATE_TTL_MS,
  setPendingDuplicate,
} from '../../lib/pendingDuplicate';

const mockUseDuplicatePlanMutation = vi.mocked(useDuplicatePlanMutation);
const mockUseRouter = vi.mocked(useRouter);

function seedPending(
  overrides: Partial<{ shareSlug: string; clientMutationId: string; createdAt: number }> = {},
) {
  setPendingDuplicate({
    shareSlug: 'test-slug',
    clientMutationId: 'dup-cid',
    createdAt: Date.now(),
    ...overrides,
  });
}

describe('PendingDuplicateFinalizer', () => {
  let duplicateMutate: ReturnType<typeof vi.fn>;
  let push: ReturnType<typeof vi.fn>;
  let refresh: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    window.sessionStorage.clear();

    duplicateMutate = vi.fn();
    mockUseDuplicatePlanMutation.mockReturnValue({ mutate: duplicateMutate } as any);

    push = vi.fn();
    refresh = vi.fn();
    mockUseRouter.mockReturnValue({ push, refresh } as any);
  });

  afterEach(() => {
    cleanup();
    window.sessionStorage.clear();
  });

  it('does nothing when sessionStorage is empty', async () => {
    render(<PendingDuplicateFinalizer />);
    await act(async () => {});
    expect(duplicateMutate).not.toHaveBeenCalled();
  });

  it('does nothing when the stored entry is expired', async () => {
    seedPending({ createdAt: Date.now() - PENDING_DUPLICATE_TTL_MS - 1 });
    render(<PendingDuplicateFinalizer />);
    await act(async () => {});
    expect(duplicateMutate).not.toHaveBeenCalled();
  });

  it('calls mutate with the stored shareSlug and clientMutationId', async () => {
    seedPending({ shareSlug: 'shared-plan', clientMutationId: 'my-cid' });
    render(<PendingDuplicateFinalizer />);

    await waitFor(() => {
      expect(duplicateMutate).toHaveBeenCalledWith(
        { shareSlug: 'shared-plan', clientMutationId: 'my-cid' },
        expect.any(Object),
      );
    });
  });

  it('onSuccess: clears storage, shows success toast, navigates to the new plan', async () => {
    seedPending();
    render(<PendingDuplicateFinalizer />);

    await waitFor(() => expect(duplicateMutate).toHaveBeenCalled());

    await act(async () => {
      duplicateMutate.mock.calls[0]![1].onSuccess({
        id: 'new-plan-id',
        name: 'Test Plan',
        shareSlug: 'test-slug',
        isPublic: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    });

    expect(window.sessionStorage.getItem(PENDING_DUPLICATE_KEY)).toBeNull();
    expect(toast.success).toHaveBeenCalledWith('Plan added to your library!');
    expect(push).toHaveBeenCalledWith('/train/plans/new-plan-id');
    expect(refresh).toHaveBeenCalled();
  });

  it('onError with NOT_FOUND: clears storage and shows unavailable toast', async () => {
    seedPending();
    render(<PendingDuplicateFinalizer />);

    await waitFor(() => expect(duplicateMutate).toHaveBeenCalled());

    await act(async () => {
      duplicateMutate.mock.calls[0]![1].onError(new ApiError('Plan not found', 404, 'NOT_FOUND'));
    });

    expect(window.sessionStorage.getItem(PENDING_DUPLICATE_KEY)).toBeNull();
    expect(toast.error).toHaveBeenCalledWith('That plan is no longer available.');
  });

  it('onError with transient failure: leaves storage intact for retry, shows retry toast', async () => {
    seedPending({ shareSlug: 'keep-slug', clientMutationId: 'keep-cid' });
    render(<PendingDuplicateFinalizer />);

    await waitFor(() => expect(duplicateMutate).toHaveBeenCalled());

    await act(async () => {
      duplicateMutate.mock.calls[0]![1].onError(new ApiError('Internal Server Error', 500));
    });

    expect(window.sessionStorage.getItem(PENDING_DUPLICATE_KEY)).not.toBeNull();
    expect(toast.error).toHaveBeenCalledWith('Could not add plan — please try again.');
    expect(toast.error).not.toHaveBeenCalledWith('That plan is no longer available.');
  });
});
