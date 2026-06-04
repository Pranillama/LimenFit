import { z } from 'zod';

import { requireUser } from '@/lib/api/auth';
import { handleApiError, jsonError, jsonOk } from '@/lib/api/responses';
import { createSupabaseServiceRoleClient } from '@/lib/supabase/service-role';

export const runtime = 'nodejs';

const bodySchema = z.object({
  confirm: z.literal('DELETE'),
});

export async function POST(request: Request): Promise<Response> {
  try {
    const { supabase, user } = await requireUser();

    const parseResult = bodySchema.safeParse(await request.json().catch(() => ({})));
    if (!parseResult.success) {
      return jsonError(400, 'VALIDATION_ERROR', 'Confirmation string must be "DELETE"');
    }

    const admin = createSupabaseServiceRoleClient();
    const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
    if (deleteError) {
      console.error('[POST /api/account/delete] admin.deleteUser failed:', deleteError);
      return jsonError(500, 'INTERNAL_SERVER_ERROR', 'Failed to delete account');
    }

    await supabase.auth.signOut();

    return jsonOk<{ ok: true }>({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
