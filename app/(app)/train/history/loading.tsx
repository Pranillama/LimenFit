import { PageContainer } from '@/components/page-container';
import { PageSkeleton } from '@/components/page-skeleton';

export default function HistoryLoading() {
  return (
    <PageContainer title="History">
      <PageSkeleton />
    </PageContainer>
  );
}
