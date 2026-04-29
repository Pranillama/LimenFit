import type { Metadata } from 'next';

import { PageContainer } from '@/components/page-container';

export const metadata: Metadata = {
  title: 'Home — LimenFit',
};

export default function HomePage() {
  return (
    <PageContainer title="Home">
      <p className="text-muted-foreground">Dashboard and quick-start widgets coming in T14.</p>
    </PageContainer>
  );
}
