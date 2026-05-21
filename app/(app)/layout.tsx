import { redirect } from 'next/navigation';

import { AppShell } from '@/features/shell';
import { isAiAssistantEnabled } from '@/lib/ai/env';
import { createSupabaseServerClient } from '@/lib/supabase/server-exports';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth');
  }

  const aiEnabled = isAiAssistantEnabled();

  return (
    <AppShell user={user} aiEnabled={aiEnabled}>
      {children}
    </AppShell>
  );
}
