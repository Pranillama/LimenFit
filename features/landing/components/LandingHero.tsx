'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { useReducedMotion } from 'framer-motion';

// ── Kinetic rotating word ────────────────────────────────────

const KINETIC_WORDS = ['friction.', 'waiting.', 'guessing.'];

function KineticWord() {
  const [idx, setIdx] = useState(0);
  const [phase, setPhase] = useState<'in' | 'out-up'>('in');
  const shouldReduce = useReducedMotion();

  useEffect(() => {
    if (shouldReduce) return;
    const cycleMs = 2800;
    const outMs = 450;
    const id = setInterval(() => {
      setPhase('out-up');
      const t = setTimeout(() => {
        setIdx((i) => (i + 1) % KINETIC_WORDS.length);
        setPhase('in');
      }, outMs);
      return () => clearTimeout(t);
    }, cycleMs);
    return () => clearInterval(id);
  }, [shouldReduce]);

  const longest = KINETIC_WORDS.reduce((a, b) => (b.length > a.length ? b : a), '');

  return (
    <span className="kinetic-word align-baseline" aria-live="polite">
      {/* invisible width reserver so the headline never reflows */}
      <span
        className="invisible"
        style={{ position: 'relative', display: 'inline-block', whiteSpace: 'nowrap' }}
      >
        {longest}
      </span>
      <span className={phase === 'in' ? 'is-in' : 'is-out-up'} style={{ left: 0, top: 0 }}>
        {KINETIC_WORDS[idx]}
      </span>
    </span>
  );
}

// ── Marquee strip ────────────────────────────────────────────

const MARQUEE_TOKENS = [
  'Fast logging',
  'Offline-first',
  'AI insights',
  'Form analysis',
  'Plan sharing',
  'Open source',
];

function HeroMarquee() {
  const renderTokens = (keyPrefix: string) =>
    MARQUEE_TOKENS.map((tok, i) => (
      <span key={`${keyPrefix}-${i}`} className="flex items-center gap-6 px-6">
        <span className="text-[11px] font-bold uppercase tracking-[0.3em] text-white/55">
          {tok}
        </span>
        <span className="h-1 w-1 rounded-full bg-brand-orange/70" />
      </span>
    ));

  return (
    <div className="pointer-events-none absolute bottom-0 left-0 right-0 z-10 overflow-hidden border-t border-white/[0.08] bg-black/40 py-4 backdrop-blur-sm">
      <div className="marquee-track">
        <div className="flex items-center">{renderTokens('a')}</div>
        <div className="flex items-center" aria-hidden="true">
          {renderTokens('b')}
        </div>
      </div>
    </div>
  );
}

// ── Hero section ─────────────────────────────────────────────

export function LandingHero() {
  const [reveal, setReveal] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setReveal(true), 50);
    return () => clearTimeout(t);
  }, []);

  const stagger = (i: number): React.CSSProperties => ({
    transform: reveal ? 'translateY(0)' : 'translateY(20px)',
    opacity: reveal ? 1 : 0,
    transition: `opacity 0.6s ease-out ${0.3 + i * 0.15}s, transform 0.6s ease-out ${0.3 + i * 0.15}s`,
  });

  return (
    <section id="home" className="relative min-h-screen overflow-hidden bg-black">
      {/* Background */}
      <div className="absolute inset-0">
        <Image
          src="/hero-athlete.png"
          alt="Athlete lifting weights"
          fill
          className="object-cover object-center md:object-left"
          priority
        />
        <div className="absolute inset-0 bg-black/65 md:hidden" />
        <div
          className="absolute inset-0 hidden md:block"
          style={{
            background:
              'linear-gradient(to right, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.45) 38%, rgba(0,0,0,0.88) 60%, rgba(0,0,0,0.97) 78%)',
          }}
        />
      </div>

      {/* Content */}
      <div className="relative z-10 mx-auto flex min-h-screen max-w-screen-xl items-center px-6 md:px-8">
        <div className="w-full md:grid md:grid-cols-2 md:items-center">
          <div className="hidden md:block" />
          <div className="space-y-6 py-32 md:pl-4">
            <div style={stagger(0)}>
              <p className="mb-3 text-xs font-bold uppercase tracking-[0.3em] text-brand-orange">
                The fastest way to train
              </p>
              <h1 className="text-5xl font-black leading-[1.05] tracking-tight sm:text-6xl lg:text-7xl">
                <span className="text-white">Less </span>
                <span className="text-brand-orange">
                  <KineticWord />
                </span>
                <br />
                <span className="text-white">More progress.</span>
              </h1>
            </div>

            <p style={stagger(1)} className="text-base text-white/60 sm:text-lg">
              Track workouts, analyze performance, and improve your training with AI-powered
              insights.
            </p>

            <div
              style={stagger(2)}
              className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:gap-4"
            >
              <Link
                href="/auth"
                className="flex items-center justify-center gap-2 rounded-md bg-brand-orange px-7 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#cc4a00]"
              >
                Get Started <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="#features"
                className="flex items-center justify-center gap-2 rounded-md border border-brand-orange bg-black/20 px-7 py-3 text-sm font-semibold text-white backdrop-blur-sm transition-colors hover:border-brand-orange/70"
              >
                See How It Works <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </div>

      <HeroMarquee />
    </section>
  );
}
