import type { Metadata } from 'next';
import Link from 'next/link';

import { PageContainer } from '@/components/page-container';

export const metadata: Metadata = {
  title: 'Train — LimenFit',
};

export default function TrainPage() {
  return (
    <PageContainer title="Train">
      <p className="mb-4 text-muted-foreground">Active workout session coming in T6/T9.</p>
      <ul className="flex flex-col gap-2 text-sm">
        <li>
          <Link href="/train/history" className="text-primary underline underline-offset-4">
            Workout History
          </Link>
        </li>
        <li>
          <Link href="/train/plans" className="text-primary underline underline-offset-4">
            My Plans
          </Link>
        </li>
      </ul>
    </PageContainer>
  );
}
