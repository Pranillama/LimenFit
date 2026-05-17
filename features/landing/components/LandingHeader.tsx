'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Dumbbell, Menu, X } from 'lucide-react';

const navLinks = [
  { label: 'home', href: '#home' },
  { label: 'feature', href: '#features' },
  { label: 'contact', href: '#contact' },
];

export function LandingHeader() {
  const [open, setOpen] = useState(false);

  return (
    // Slide down from above viewport on mount — pattern from AnimatedHero
    <motion.header
      className="fixed left-0 right-0 top-0 z-50 bg-black"
      initial={{ y: -80, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.8, ease: 'easeOut' }}
    >
      <div className="mx-auto flex h-16 max-w-screen-xl items-center justify-between px-6 md:px-8">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 text-white">
          <Dumbbell className="h-6 w-6" />
          <span className="text-base font-bold uppercase tracking-[0.2em]">LimenFit</span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-10 md:flex">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm text-white/70 transition-colors hover:text-brand-orange"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Desktop JoinNow */}
        <Link
          href="/auth"
          className="hidden text-sm font-medium text-white/90 transition-colors hover:text-brand-orange md:block"
        >
          JoinNow
        </Link>

        {/* Mobile hamburger */}
        <button
          className="p-1 text-white md:hidden"
          onClick={() => setOpen((v) => !v)}
          aria-label="Toggle menu"
        >
          {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {/* Mobile dropdown */}
      {open && (
        <div className="flex flex-col gap-4 border-t border-white/10 bg-black px-6 py-5 md:hidden">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm text-white/70 transition-colors hover:text-brand-orange"
              onClick={() => setOpen(false)}
            >
              {link.label}
            </Link>
          ))}
          <Link
            href="/auth"
            className="text-sm font-medium text-white/90 transition-colors hover:text-brand-orange"
            onClick={() => setOpen(false)}
          >
            JoinNow
          </Link>
        </div>
      )}
    </motion.header>
  );
}
