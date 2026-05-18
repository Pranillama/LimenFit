'use client';

import { useParallax, useReveal } from '../lib/hooks';

const WHY = {
  eyebrow: 'WHY LIMENFIT?',
  headline: ['Built for the', 'set in front of you.'],
  pain: "Most fitness apps are bloated with social feeds, paywalled progress, and friction you don't need mid-set.",
  success:
    'LimenFit is built around a single promise: log fast, reflect clearly, improve consistently — whether you lift solo or coach a team.',
  pillars: [
    { stat: '< 3s', label: 'to log a set', detail: 'Optimistic UI, zero modals' },
    { stat: '100%', label: 'works offline', detail: 'Your data, on your device' },
    { stat: '0', label: 'social feeds', detail: 'No vanity, no algorithm' },
  ],
} as const;

export function LandingWhyLimenFit() {
  // Each layer has its own ref so parallax measures that element's viewport distance
  const [bgRef, bgOffset] = useParallax(-0.35, 1);
  const [glowRef, glowOffset] = useParallax(0.18, 1);
  const [fgRef, fgOffset] = useParallax(0.08, 1);
  const [pillarsRef, pillarsOffset] = useParallax(0.18, 1);
  const [revealRef, visible] = useReveal<HTMLElement>();

  return (
    <section
      id="why"
      ref={revealRef}
      className="relative scroll-mt-20 overflow-hidden py-32 sm:py-40"
    >
      {/* Background — oversized outlined PROGRESS. word
          Use left-1/2 + translateX(-50%) so the text overflows
          symmetrically on both sides regardless of container width. */}
      <div
        ref={bgRef as React.RefObject<HTMLDivElement>}
        className="parallax-layer pointer-events-none absolute inset-x-0 top-0"
        style={{ transform: `translate3d(0, ${bgOffset}px, 0)` }}
        aria-hidden="true"
      >
        <span
          className="display-outline absolute left-1/2 whitespace-nowrap text-[20vw]"
          style={{ top: '6vh', transform: 'translateX(-50%)' }}
        >
          PROGRESS.
        </span>
      </div>

      {/* Orange glow blob */}
      <div
        ref={glowRef as React.RefObject<HTMLDivElement>}
        className="parallax-layer pointer-events-none absolute left-1/2 top-1/2 h-[420px] w-[420px]"
        style={{ transform: `translate3d(-50%, calc(-50% + ${glowOffset}px), 0)` }}
        aria-hidden="true"
      >
        <div className="orange-glow h-full w-full" />
      </div>

      {/* Foreground content */}
      <div
        ref={fgRef as React.RefObject<HTMLDivElement>}
        className="parallax-layer relative z-10 mx-auto max-w-4xl px-4 sm:px-6"
        style={{ transform: `translate3d(0, ${fgOffset}px, 0)` }}
      >
        <div
          className="text-center"
          style={{
            opacity: visible ? 1 : 0,
            transform: visible ? 'translateY(0)' : 'translateY(24px)',
            transition: 'opacity .7s ease-out, transform .7s ease-out',
          }}
        >
          <p className="mb-4 text-xs font-bold uppercase tracking-[0.3em] text-brand-orange">
            {WHY.eyebrow}
          </p>
          <h2 className="text-4xl font-black leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
            <span className="text-white">{WHY.headline[0]} </span>
            <span className="text-brand-orange">{WHY.headline[1]}</span>
          </h2>
        </div>

        <div className="mx-auto mt-16 grid max-w-3xl gap-10 sm:grid-cols-[auto_1fr] sm:gap-x-8">
          {/* Pain label */}
          <div
            className="flex items-start gap-4 sm:flex-col sm:items-center sm:pt-1"
            style={{
              opacity: visible ? 1 : 0,
              transform: visible ? 'translateY(0)' : 'translateY(24px)',
              transition: 'opacity .7s ease-out .2s, transform .7s ease-out .2s',
            }}
          >
            <span className="mt-1 text-xs font-bold uppercase tracking-[0.25em] text-white/40">
              The pain
            </span>
            <span className="hidden h-12 w-px bg-white/15 sm:block" />
          </div>
          <p
            className="text-lg leading-relaxed text-white/70 sm:text-xl"
            style={{
              opacity: visible ? 1 : 0,
              transform: visible ? 'translateY(0)' : 'translateY(24px)',
              transition: 'opacity .7s ease-out .25s, transform .7s ease-out .25s',
            }}
          >
            {WHY.pain}
          </p>

          {/* Promise label */}
          <div
            className="flex items-start gap-4 sm:flex-col sm:items-center sm:pt-1"
            style={{
              opacity: visible ? 1 : 0,
              transform: visible ? 'translateY(0)' : 'translateY(24px)',
              transition: 'opacity .7s ease-out .35s, transform .7s ease-out .35s',
            }}
          >
            <span className="mt-1 text-xs font-bold uppercase tracking-[0.25em] text-brand-orange">
              The promise
            </span>
            <span className="hidden h-12 w-px bg-brand-orange/50 sm:block" />
          </div>
          <p
            className="text-lg leading-relaxed text-white/85 sm:text-xl"
            style={{
              opacity: visible ? 1 : 0,
              transform: visible ? 'translateY(0)' : 'translateY(24px)',
              transition: 'opacity .7s ease-out .4s, transform .7s ease-out .4s',
            }}
          >
            {WHY.success}
          </p>
        </div>
      </div>

      {/* Pillars row — closer parallax plane */}
      <div
        ref={pillarsRef as React.RefObject<HTMLDivElement>}
        className="parallax-layer relative z-10 mx-auto mt-20 max-w-5xl px-4 sm:px-6"
        style={{ transform: `translate3d(0, ${pillarsOffset}px, 0)` }}
      >
        <div className="grid grid-cols-1 gap-px overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.04] sm:grid-cols-3">
          {WHY.pillars.map((p, i) => (
            <div
              key={p.label}
              className="relative bg-[#0a0a0a] p-7 transition-colors hover:bg-[#101010]"
              style={{
                opacity: visible ? 1 : 0,
                transform: visible ? 'translateY(0)' : 'translateY(24px)',
                transition: `opacity .6s ease-out ${0.5 + i * 0.08}s, transform .6s ease-out ${0.5 + i * 0.08}s`,
              }}
            >
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-black leading-none tracking-tight text-brand-orange sm:text-5xl">
                  {p.stat}
                </span>
              </div>
              <p className="mt-3 text-base font-semibold text-white">{p.label}</p>
              <p className="mt-1 text-sm text-white/45">{p.detail}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
