import { PageContainer } from '@/components/page-container';
import { PageSkeleton } from '@/components/page-skeleton';

export default function HomeLoading() {
  return (
    <PageContainer>
      <PageSkeleton />
    </PageContainer>
  );
}
