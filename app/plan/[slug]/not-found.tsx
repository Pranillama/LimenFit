import Link from 'next/link';

import { Button } from '@/components/ui/button';

export default function PublicPlanNotFound() {
  return (
    <div className="rounded-lg border bg-card p-6 text-center">
      <h1 className="text-xl font-semibold tracking-tight">Plan not found</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        This plan doesn&apos;t exist or is no longer public.
      </p>
      <div className="mt-4 flex justify-center gap-2">
        <Button asChild variant="outline">
          <Link href="/">Home</Link>
        </Button>
        <Button asChild>
          <Link href="/auth">Sign up</Link>
        </Button>
      </div>
    </div>
  );
}
