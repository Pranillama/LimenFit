import { redirect } from 'next/navigation';

import { AppShell } from '@/features/shell';
import { createSupabaseServerClient } from '@/lib/supabase/server-exports';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth');
  }

  return <AppShell user={user}>{children}</AppShell>;
}
