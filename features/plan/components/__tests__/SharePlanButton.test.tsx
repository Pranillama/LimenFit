// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('../../hooks/useSharePlanMutation', () => ({
  useSharePlanMutation: vi.fn(),
}));

vi.mock('@/components/ui/sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

import { SharePlanButton } from '../SharePlanButton';
import { useSharePlanMutation } from '../../hooks/useSharePlanMutation';
import { toast } from '@/components/ui/sonner';
import type { SharePlanResponse } from '../../hooks/useSharePlanMutation';

const mockUseSharePlanMutation = vi.mocked(useSharePlanMutation);

/**
 * navigator.clipboard is non-writable in jsdom, so simple property assignment is silently
 * dropped. Use a Proxy that intercepts only the `clipboard` get so userEvent's own navigator
 * accesses still reach the real jsdom navigator.
 */
function stubClipboard(clipboardValue: { writeText: ReturnType<typeof vi.fn> } | undefined) {
  vi.stubGlobal(
    'navigator',
    new Proxy(window.navigator, {
      get(target, prop) {
        if (prop === 'clipboard') return clipboardValue;
        return Reflect.get(target, prop, target);
      },
    }),
  );
}

/**
 * document.execCommand is also absent in jsdom 29.1.1 — assign it directly as a vi.fn.
 */
function stubExecCommand(returns: boolean): ReturnType<typeof vi.fn> {
  const mock = vi.fn().mockReturnValue(returns);
  (document as any).execCommand = mock;
  return mock;
}

describe('SharePlanButton', () => {
  let shareMutate: ReturnType<typeof vi.fn>;
  let writeText: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    shareMutate = vi.fn();
    mockUseSharePlanMutation.mockReturnValue({ mutate: shareMutate, isPending: false } as any);
    // Default: clipboard resolves; execCommand succeeds as fallback.
    writeText = vi.fn().mockResolvedValue(undefined);
    stubClipboard({ writeText });
    stubExecCommand(true);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    delete (document as any).execCommand;
  });

  const baseProps = { planId: 'plan-1', initialShareSlug: 'my-slug', initialIsPublic: true };

  it('renders a Share button', () => {
    render(<SharePlanButton {...baseProps} />);
    expect(screen.getByRole('button', { name: /share/i })).toBeTruthy();
  });

  describe('already-public plan', () => {
    it('copies the plan URL to clipboard and shows success toast', async () => {
      const user = userEvent.setup();
      render(<SharePlanButton {...baseProps} />);
      await user.click(screen.getByRole('button', { name: /share/i }));

      await waitFor(() => {
        expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/plan/my-slug`);
        expect(toast.success).toHaveBeenCalledWith('Link copied!');
      });
      expect(shareMutate).not.toHaveBeenCalled();
    });

    it('falls back to execCommand when clipboard.writeText rejects', async () => {
      writeText = vi.fn().mockRejectedValue(new DOMException('', 'NotAllowedError'));
      stubClipboard({ writeText });
      const execCmd = stubExecCommand(true);

      const user = userEvent.setup();
      render(<SharePlanButton {...baseProps} />);
      await user.click(screen.getByRole('button', { name: /share/i }));

      await waitFor(() => {
        expect(writeText).toHaveBeenCalled();
        expect(execCmd).toHaveBeenCalledWith('copy');
        expect(toast.success).toHaveBeenCalledWith('Link copied!');
      });
    });

    it('shows manual-copy error when both clipboard strategies fail', async () => {
      writeText = vi.fn().mockRejectedValue(new DOMException('', 'NotAllowedError'));
      stubClipboard({ writeText });
      stubExecCommand(false);

      const user = userEvent.setup();
      render(<SharePlanButton {...baseProps} />);
      await user.click(screen.getByRole('button', { name: /share/i }));

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Could not copy link — please copy it manually');
      });
    });

    it('shows manual-copy error when clipboard is absent and execCommand fails', async () => {
      stubClipboard(undefined);
      stubExecCommand(false);

      const user = userEvent.setup();
      render(<SharePlanButton {...baseProps} />);
      await user.click(screen.getByRole('button', { name: /share/i }));

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Could not copy link — please copy it manually');
      });
    });
  });

  describe('not-yet-public plan', () => {
    const notPublicProps = { ...baseProps, initialIsPublic: false };

    it('calls the share mutation with the plan id', async () => {
      const user = userEvent.setup();
      render(<SharePlanButton {...notPublicProps} />);
      await user.click(screen.getByRole('button', { name: /share/i }));
      expect(shareMutate).toHaveBeenCalledWith({ id: 'plan-1' }, expect.any(Object));
    });

    it('copies new URL and shows Link copied toast on mutation success', async () => {
      const user = userEvent.setup();
      render(<SharePlanButton {...notPublicProps} />);
      await user.click(screen.getByRole('button', { name: /share/i }));

      const successData: SharePlanResponse = {
        id: 'plan-1',
        clientMutationId: 'cid-x',
        shareSlug: 'new-slug',
        isPublic: true,
      };
      await act(async () => {
        await shareMutate.mock.calls[0]![1].onSuccess(successData);
      });

      await waitFor(() => {
        expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/plan/new-slug`);
        expect(toast.success).toHaveBeenCalledWith('Link copied!');
      });
    });

    it('shows Plan published toast when clipboard fails after mutation success', async () => {
      writeText = vi.fn().mockRejectedValue(new DOMException('', 'NotAllowedError'));
      stubClipboard({ writeText });
      stubExecCommand(false);

      const user = userEvent.setup();
      render(<SharePlanButton {...notPublicProps} />);
      await user.click(screen.getByRole('button', { name: /share/i }));

      const successData: SharePlanResponse = {
        id: 'plan-1',
        clientMutationId: 'cid-x',
        shareSlug: 'new-slug',
        isPublic: true,
      };
      await act(async () => {
        await shareMutate.mock.calls[0]![1].onSuccess(successData);
      });

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith('Plan published — copy link manually');
      });
    });
  });
});
