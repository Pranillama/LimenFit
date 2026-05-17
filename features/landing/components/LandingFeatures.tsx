'use client';

import Image from 'next/image';
import { motion } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';
import { Zap, Link2, WifiOff, Video, Sparkles } from 'lucide-react';

// ── Shared helpers ────────────────────────────────

function CardMotion({ delay = 0, children }: { delay?: number; children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      whileHover={{ y: -5, transition: { duration: 0.2, ease: 'easeOut' } }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.5, ease: 'easeOut', delay }}
    >
      {children}
    </motion.div>
  );
}

function IconBadge({ icon: Icon }: { icon: LucideIcon }) {
  return (
    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#1e1e1e]">
      <Icon className="h-6 w-6 text-brand-orange" />
    </div>
  );
}

const card = 'relative overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0a0a0a] transition-colors duration-200 hover:border-white/[0.18]';

// ── Fast Logging ──────────────────────────────────

function FastLoggingCard() {
  return (
    <div className={`${card} h-[250px] p-6`}>
      <div className="flex max-w-[52%] flex-col gap-3">
        <IconBadge icon={Zap} />
        <h3 className="text-xl font-bold text-white">Fast logging</h3>
        <p className="text-sm leading-relaxed text-white/50">
          Add sets and reps in seconds. No tapping through menus. LimenFit gets out of the way so
          you can focus on your training.
        </p>
      </div>
      {/* Phone mockup image */}
      <div className="absolute inset-y-0 right-0 w-[50%]">
        <Image
          src="/fatslogging.png"
          alt="Fast logging app screen"
          fill
          className="object-cover object-center"
          quality={95}
          style={{ filter: 'contrast(1.06) brightness(1.05)' }}
        />
        {/* Subtle left fade so image blends into card background */}
        <div className="absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-[#0a0a0a] to-transparent" />
      </div>
    </div>
  );
}

// ── Plan Sharing ──────────────────────────────────

function PlanSharingCard() {
  return (
    <div className={`${card} h-[250px] p-6`}>
      <div className="flex max-w-[48%] flex-col gap-3">
        <IconBadge icon={Link2} />
        <h3 className="text-xl font-bold text-white">Plan sharing</h3>
        <p className="text-sm leading-relaxed text-white/50">
          Build structured training programmes and share them with friends or coaches with a single
          link.
        </p>
      </div>
      {/* Phone mockup image */}
      <div className="absolute inset-y-0 right-0 w-[52%]">
        <Image
          src="/plansharing.png"
          alt="Plan sharing app screen"
          fill
          className="object-cover object-center"
          quality={95}
          style={{ filter: 'contrast(1.06) brightness(1.05)' }}
        />
        <div className="absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-[#0a0a0a] to-transparent" />
      </div>
    </div>
  );
}

// ── Offline First ─────────────────────────────────

function OfflineFirstCard() {
  return (
    <div className={`${card} h-[250px]`}>
      {/* Full background image */}
      <div className="absolute inset-0">
        <Image
          src="/offlinefirst.png"
          alt=""
          fill
          className="object-contain object-right"
          quality={95}
          style={{ filter: 'contrast(1.1) brightness(1.05) saturate(1.1)' }}
        />
        {/* Left gradient: covers screenshot text artefacts, darkens left for readable text */}
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(to right, #0a0a0a 0%, #0a0a0a 28%, rgba(17,17,17,0.72) 50%, rgba(17,17,17,0.08) 74%, transparent 100%)',
          }}
        />
      </div>
      {/* Text */}
      <div className="relative z-10 flex max-w-[38%] flex-col gap-3 p-6">
        <IconBadge icon={WifiOff} />
        <h3 className="text-xl font-bold text-white">Offline-first</h3>
        <p className="text-sm leading-relaxed text-white/50">
          Your workout data lives on your device first. Log sessions in the basement gym or in the
          mountains with zero connectivity.
        </p>
      </div>
    </div>
  );
}

// ── Form Analysis ─────────────────────────────────

function FormAnalysisCard() {
  return (
    <div className={`${card} h-[250px]`}>
      {/* object-center shows the person squatting; narrow gradient covers far-left text artefacts */}
      <div className="absolute inset-0">
        <Image
          src="/formanalysis.png"
          alt=""
          fill
          className="object-contain object-right"
          quality={95}
          style={{ filter: 'contrast(1.1) brightness(1.06) saturate(1.1)' }}
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(to right, #0a0a0a 0%, #0a0a0a 28%, rgba(17,17,17,0.85) 44%, rgba(17,17,17,0.3) 62%, rgba(17,17,17,0.05) 80%, transparent 100%)',
          }}
        />
      </div>
      {/* Text — narrower so more of the person is exposed */}
      <div className="relative z-10 flex max-w-[45%] flex-col gap-3 p-6">
        <IconBadge icon={Video} />
        <h3 className="text-xl font-bold text-white">Form analysis</h3>
        <p className="text-sm leading-relaxed text-white/50">
          Upload a clip of your lift and get instant technique feedback powered by computer vision.
          Catch form breaks before they become injuries.
        </p>
      </div>
    </div>
  );
}

// ── AI Insights ───────────────────────────────────

function AIInsightsCard() {
  return (
    <div className={`${card} h-[250px] p-6`}>
      <div className="flex max-w-[52%] flex-col gap-3">
        <IconBadge icon={Sparkles} />
        <h3 className="text-xl font-bold text-white">AI insights</h3>
        <p className="text-sm leading-relaxed text-white/50">
          Get AI-generated workout summaries, progress insights, and training recommendations.
        </p>
      </div>
      {/* Stacked cards image on the right */}
      <div className="absolute inset-y-4 right-4 w-[44%]">
        <Image
          src="/aiinsight.png"
          alt="AI insights preview"
          fill
          className="object-contain object-center"
          quality={95}
          style={{ filter: 'contrast(1.06) brightness(1.05) saturate(1.05)' }}
        />
      </div>
    </div>
  );
}

// ── Section ───────────────────────────────────────

export function LandingFeatures() {
  return (
    <section id="features" className="scroll-mt-20 py-10">
      {/* Heading */}
      <div className="mb-8 text-center">
        <p className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-brand-orange">
          Built for lifters. Backed by tech.
        </p>
        <h2 className="text-4xl font-black leading-tight lg:text-5xl">
          <span className="text-white">Powerful features.</span>
          <br />
          <span className="text-brand-orange">Better training.</span>
        </h2>
      </div>

      {/* Row 1: Fast logging | Plan sharing | AI insights */}
      <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <CardMotion delay={0}>
          <FastLoggingCard />
        </CardMotion>
        <CardMotion delay={0.08}>
          <PlanSharingCard />
        </CardMotion>
        <CardMotion delay={0.16}>
          <AIInsightsCard />
        </CardMotion>
      </div>

      {/* Row 2: Form analysis | Offline-first */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <CardMotion delay={0.1}>
          <FormAnalysisCard />
        </CardMotion>
        <CardMotion delay={0.18}>
          <OfflineFirstCard />
        </CardMotion>
      </div>
    </section>
  );
}
