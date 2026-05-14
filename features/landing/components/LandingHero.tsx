import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { HERO } from '../lib/content';

export function LandingHero() {
  return (
    <section className="py-24 text-center">
      <div className="mx-auto max-w-2xl space-y-6">
        <h1 className="font-sans text-5xl font-semibold tracking-tight sm:text-6xl">
          {HERO.headline}
        </h1>
        <p className="text-lg text-muted-foreground">{HERO.subheadline}</p>
        <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <Button asChild size="lg">
            <Link href="/auth">{HERO.cta}</Link>
          </Button>
          <Button asChild variant="ghost" size="lg">
            <Link href={HERO.secondaryHref}>{HERO.secondaryCta}</Link>
          </Button>
        </div>
        {/* Illustration mounts here in Phase B */}
        <div data-slot="hero-illustration" className="mt-12 h-64 w-full" />
      </div>
    </section>
  );
}
