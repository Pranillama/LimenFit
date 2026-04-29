import type { Metadata } from 'next';

import { PageContainer } from '@/components/page-container';

export const metadata: Metadata = {
  title: 'My Plans — LimenFit',
};

export default function PlansPage() {
  return (
    <PageContainer title="My Plans">
      <p className="text-muted-foreground">Training plans CRUD coming in T11/T12.</p>
    </PageContainer>
  );
}
