import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';

import { PageContainer } from '@/components/page-container';
import { isAiAssistantEnabled } from '@/lib/ai/env';
import { createSupabaseServerClient } from '@/lib/supabase/server-exports';
import { ChatView } from '@/features/ask';

export const metadata: Metadata = {
  title: 'Ask — LimenFit',
};

const SUGGESTED_PROMPTS = [
  'What should I do for my next bench session?',
  'When did I last hit my squat PR?',
  'Suggest a substitute for deadlifts today.',
  "How's my training volume trending?",
  'What muscle groups have I been skipping?',
  'Plan a workout for tomorrow.',
];

export default async function AskPage() {
  if (!isAiAssistantEnabled()) {
    notFound();
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/');

  return (
    <PageContainer>
      <ChatView suggestedPrompts={SUGGESTED_PROMPTS} />
    </PageContainer>
  );
}
