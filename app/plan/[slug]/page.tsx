import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { PublicPlanViewer } from '@/features/plan/components/PublicPlanViewer';
import { fetchPublicPlanBySlug } from '@/features/plan/lib/publicPlanDTO';
import { createSupabaseServerClient } from '@/lib/supabase/server-exports';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const SHARE_SLUG_RE = /^[A-Za-z0-9_-]{8,64}$/;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  if (!SHARE_SLUG_RE.test(slug)) {
    return { title: 'Plan — LimenFit', description: 'Public training plan on LimenFit' };
  }
  const plan = await fetchPublicPlanBySlug(slug);
  if (!plan) {
    return { title: 'Plan — LimenFit', description: 'Public training plan on LimenFit' };
  }
  return {
    title: `${plan.name} — LimenFit`,
    description: 'Public training plan on LimenFit',
  };
}

export default async function PublicPlanPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  if (!SHARE_SLUG_RE.test(slug)) {
    notFound();
  }

  const plan = await fetchPublicPlanBySlug(slug);
  if (!plan) {
    notFound();
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return <PublicPlanViewer plan={plan} viewerIsLoggedIn={!!user} />;
}
