import { requireUser } from '@/lib/api/auth';
import { handleApiError, jsonError, jsonOk } from '@/lib/api/responses';
import { withIdempotency } from '@/lib/idempotency/server';
import { planSharePostBodySchema } from '@/lib/schemas/plan';
import { UUID_RE } from '@/lib/utils';

export const runtime = 'nodejs';

class RouteError extends Error {
  constructor(public readonly response: Response) {
    super('RouteError');
    this.name = 'RouteError';
  }
}

type ShareResponse = {
  id: string;
  clientMutationId: string;
  shareSlug: string;
  isPublic: boolean;
};

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const { supabase, user } = await requireUser();
    const userId = user.id;
    const { id } = await params;

    if (!UUID_RE.test(id)) {
      return jsonError(400, 'INVALID_ID', 'id must be a valid UUID');
    }

    const body = planSharePostBodySchema.parse(await request.json());
    const { clientMutationId } = body;

    const result = await withIdempotency<ShareResponse>({
      supabase,
      userId,
      clientMutationId,
      mutationType: 'plan.share',
      resourceType: 'plans',
      handler: async () => {
        const { data, error } = await supabase
          .from('plans')
          .update({ is_public: true })
          .eq('id', id)
          .eq('user_id', userId)
          .select('id, share_slug, is_public')
          .maybeSingle();
        if (error) throw error;
        if (!data) {
          throw new RouteError(jsonError(404, 'NOT_FOUND', 'Plan not found'));
        }

        return {
          resourceId: data.id,
          response: {
            id: data.id,
            clientMutationId,
            shareSlug: data.share_slug,
            isPublic: data.is_public,
          },
        };
      },
    });

    if (result.replayed) {
      const { data, error } = await supabase
        .from('plans')
        .select('share_slug, is_public')
        .eq('id', result.resourceId!)
        .eq('user_id', userId)
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new RouteError(jsonError(404, 'NOT_FOUND', 'Plan not found'));
      return jsonOk({
        id: result.resourceId!,
        clientMutationId,
        shareSlug: data.share_slug,
        isPublic: data.is_public,
      });
    }

    return jsonOk(result.response!);
  } catch (err) {
    if (err instanceof RouteError) return err.response;
    return handleApiError(err);
  }
}
