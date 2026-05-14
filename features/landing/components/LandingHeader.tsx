import Link from 'next/link';
import { Button } from '@/components/ui/button';

export function LandingHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-sm">
      <div className="max-w-6xl mx-auto px-6 flex h-14 items-center justify-between">
        <Link href="/" className="text-xl font-semibold tracking-tight text-foreground">
          LimenFit
        </Link>
        <Button asChild size="sm">
          <Link href="/auth">Get Started</Link>
        </Button>
      </div>
    </header>
  );
}
