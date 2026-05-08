import type { Metadata } from 'next';

import { PageContainer } from '@/components/page-container';

export const metadata: Metadata = {
  title: 'Edit Plan — LimenFit',
};

export default function EditPlanPage() {
  return (
    <PageContainer title="Edit Plan">
      <p className="text-muted-foreground">Plan editor coming soon.</p>
    </PageContainer>
  );
}
