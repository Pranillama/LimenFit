import type { Metadata } from 'next';

import { TrainPageShell } from '@/features/workout/components/TrainPageShell';

export const metadata: Metadata = {
  title: 'Train — LimenFit',
};

export default function TrainPage() {
  return <TrainPageShell />;
}
