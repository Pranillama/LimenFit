'use client';

import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';

// Animation variants from AnimatedHero pattern
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.15,
      delayChildren: 0.3,
    },
  },
};

const itemVariants = {
  hidden: { y: 20, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: {
      duration: 0.6,
      ease: 'easeOut',
    },
  },
};

export function LandingHero() {
  return (
    <section id="home" className="relative min-h-screen overflow-hidden bg-black">
      {/* Hero background image */}
      <div className="absolute inset-0">
        <Image
          src="/hero-athlete.png"
          alt="Athlete lifting weights"
          fill
          className="object-cover object-center md:object-left"
          priority
        />
        {/* Mobile: uniform dark overlay so full-width text stays readable */}
        <div className="absolute inset-0 bg-black/65 md:hidden" />
        {/* Desktop: left is transparent (athlete visible), right fades to black */}
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
        {/* Mobile: full-width text  |  Desktop: grid with text in right column */}
        <div className="w-full md:grid md:grid-cols-2 md:items-center">
          <div className="hidden md:block" /> {/* spacer — athlete image area */}

          {/* Container with staggered children — pattern from AnimatedHero */}
          <motion.div
            className="space-y-6 py-32 md:pl-4"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            <motion.h1
              variants={itemVariants}
              className="text-5xl font-black leading-[1.05] tracking-tight sm:text-6xl lg:text-7xl"
            >
              <span className="text-white">Less </span>
              <span className="text-brand-orange">friction.</span>
              <br />
              <span className="text-white">More progress.</span>
            </motion.h1>

            <motion.p
              variants={itemVariants}
              className="text-base text-white/60 sm:text-lg"
            >
              Track workouts, analyze performance, and improve your training with AI-powered
              insights.
            </motion.p>

            <motion.div
              variants={itemVariants}
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
            </motion.div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
