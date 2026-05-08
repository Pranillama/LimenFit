import type { Metadata } from 'next';

import { PlanEditor } from '@/features/plan/components/PlanEditor';

export const metadata: Metadata = {
  title: 'New Plan — LimenFit',
};

export default function NewPlanPage() {
  return <PlanEditor mode="create" />;
}
