import { createSupabaseServerClient } from '@/lib/supabase/server-exports';
import { redirect } from 'next/navigation';
import type { NextRequest } from 'next/server';
import { sanitizeNext } from '../utils';

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get('code');
  const next = sanitizeNext(searchParams.get('next')) ?? '/home';

  if (code) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      redirect(next);
    }
  }

  redirect('/auth?error=oauth_failed');
}
