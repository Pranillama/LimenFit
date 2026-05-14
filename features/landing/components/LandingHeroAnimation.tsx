'use client';

import Link from 'next/link';
import { motion, useReducedMotion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { HERO } from '../lib/content';
import { HeroIllustration } from './illustrations/HeroIllustration';

export function LandingHeroAnimation() {
  const shouldReduce = useReducedMotion();

  const variants = shouldReduce
    ? { initial: {}, animate: {} }
    : {
        initial: { opacity: 0, y: 20 },
        animate: { opacity: 1, y: 0 },
      };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <motion.h1
        className="font-sans text-5xl font-semibold tracking-tight sm:text-6xl"
        initial={variants.initial}
        animate={variants.animate}
        transition={{ duration: 0.4, ease: 'easeOut' }}
      >
        {HERO.headline}
      </motion.h1>
      <motion.p
        className="text-lg text-muted-foreground"
        initial={variants.initial}
        animate={variants.animate}
        transition={{ duration: 0.4, ease: 'easeOut', delay: 0.14 }}
      >
        {HERO.subheadline}
      </motion.p>
      <motion.div
        className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center"
        initial={variants.initial}
        animate={variants.animate}
        transition={{ duration: 0.4, ease: 'easeOut', delay: 0.26 }}
      >
        <Button asChild size="lg">
          <Link href="/auth">{HERO.cta}</Link>
        </Button>
        <Button asChild variant="ghost" size="lg">
          <Link href={HERO.secondaryHref}>{HERO.secondaryCta}</Link>
        </Button>
      </motion.div>
      <div className="mt-12 h-64 w-full">
        <HeroIllustration />
      </div>
    </div>
  );
}
