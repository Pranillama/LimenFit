import type { Metadata } from 'next';

import { PageContainer } from '@/components/page-container';

export const metadata: Metadata = {
  title: 'History — LimenFit',
};

export default function HistoryPage() {
  return (
    <PageContainer title="History">
      <p className="text-muted-foreground">Workout history list coming in T10.</p>
    </PageContainer>
  );
}
