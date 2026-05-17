import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { createSupabaseServerClient } from '@/lib/supabase/server-exports';
import { LandingPage } from '@/features/landing';

export const metadata: Metadata = {
  title: 'LimenFit',
  description: 'Fast workout logging. Soon: AI form analysis.',
};

export default async function Page() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect('/home');
  }

  return <LandingPage />;
}
