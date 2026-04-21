import { redirect } from 'next/navigation';
import type { Metadata } from 'next';

import { AuthCard } from '@/features/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const metadata: Metadata = {
  title: 'Sign in — LimenFit',
};

interface Props {
  searchParams: Promise<{ next?: string | string[]; error?: string | string[] }>;
}

function sanitizeNext(value: string | string[] | undefined): string | undefined {
  if (!value || Array.isArray(value)) return undefined;
  if (value.startsWith('/') && !value.startsWith('//')) return value;
  return undefined;
}

export default async function AuthPage({ searchParams }: Props) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (session) {
    redirect('/home');
  }

  const { next: rawNext, error: rawError } = await searchParams;
  const next = sanitizeNext(rawNext);
  const error = Array.isArray(rawError) ? undefined : rawError;

  return <AuthCard next={next} authError={error} />;
}
