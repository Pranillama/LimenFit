import { PageContainer } from '@/components/page-container';
import { PageSkeleton } from '@/components/page-skeleton';

export default function PlansLoading() {
  return (
    <PageContainer title="My Plans">
      <PageSkeleton />
    </PageContainer>
  );
}
