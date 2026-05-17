import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@tanstack/react-query', () => ({
  useMutation: vi.fn(() => ({ isPending: false })),
  useQueryClient: vi.fn(() => ({ invalidateQueries: vi.fn() })),
}));

vi.mock('@/components/ui/sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

vi.mock('@/lib/idempotency', () => ({
  newClientMutationId: vi.fn(() => 'test-mutation-id'),
}));

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/components/ui/sonner';
import { useSharePlanMutation } from '../useSharePlanMutation';

const mockUseMutation = vi.mocked(useMutation);
const mockUseQueryClient = vi.mocked(useQueryClient);

describe('useSharePlanMutation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseQueryClient.mockReturnValue({ invalidateQueries: vi.fn() } as any);
  });

  it('registers a mutation that POSTs to the share endpoint with idempotency header', async () => {
    let capturedOptions: Parameters<typeof useMutation>[0] | undefined;
    mockUseMutation.mockImplementation((opts) => {
      capturedOptions = opts as Parameters<typeof useMutation>[0];
      return { isPending: false } as any;
    });

    useSharePlanMutation();

    expect(capturedOptions).toBeDefined();

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          id: 'plan-1',
          clientMutationId: 'test-mutation-id',
          shareSlug: 'abc-def-ghi',
          isPublic: true,
        }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await (capturedOptions as any).mutationFn({ id: 'plan-1' });

    expect(fetchMock).toHaveBeenCalledWith('/api/plans/plan-1/share', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': 'test-mutation-id',
      },
      body: JSON.stringify({ clientMutationId: 'test-mutation-id' }),
    });

    expect(result).toEqual({
      id: 'plan-1',
      clientMutationId: 'test-mutation-id',
      shareSlug: 'abc-def-ghi',
      isPublic: true,
    });

    vi.unstubAllGlobals();
  });

  it('throws when the response is not ok', async () => {
    let capturedOptions: Parameters<typeof useMutation>[0] | undefined;
    mockUseMutation.mockImplementation((opts) => {
      capturedOptions = opts as Parameters<typeof useMutation>[0];
      return { isPending: false } as any;
    });

    useSharePlanMutation();

    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      json: () => Promise.resolve({ error: { message: 'Forbidden' } }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect((capturedOptions as any).mutationFn({ id: 'plan-1' })).rejects.toThrow(
      'Forbidden',
    );

    vi.unstubAllGlobals();
  });

  it('invalidates plans queries on success', () => {
    const invalidateQueries = vi.fn();
    mockUseQueryClient.mockReturnValue({ invalidateQueries } as any);

    let capturedOptions: Parameters<typeof useMutation>[0] | undefined;
    mockUseMutation.mockImplementation((opts) => {
      capturedOptions = opts as Parameters<typeof useMutation>[0];
      return { isPending: false } as any;
    });

    useSharePlanMutation();

    (capturedOptions as any).onSuccess({
      id: 'plan-1',
      clientMutationId: 'cid',
      shareSlug: 'slug',
      isPublic: true,
    });

    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['plans'] });
  });

  it('toasts an error on failure', () => {
    let capturedOptions: Parameters<typeof useMutation>[0] | undefined;
    mockUseMutation.mockImplementation((opts) => {
      capturedOptions = opts as Parameters<typeof useMutation>[0];
      return { isPending: false } as any;
    });

    useSharePlanMutation();
    (capturedOptions as any).onError(new Error('Network error'));

    expect(toast.error).toHaveBeenCalledWith('Failed to share plan');
  });
});
