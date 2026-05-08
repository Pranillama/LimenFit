import type { Metadata } from 'next';

import { PageContainer } from '@/components/page-container';

export const metadata: Metadata = {
  title: 'New Plan — LimenFit',
};

export default function NewPlanPage() {
  return (
    <PageContainer title="Create Plan">
      <p className="text-muted-foreground">Plan editor coming soon.</p>
    </PageContainer>
  );
}
