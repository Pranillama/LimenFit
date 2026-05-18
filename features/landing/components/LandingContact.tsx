'use client';

import { useState } from 'react';
import { ArrowRight, ArrowUpRight, Check, Copy, Mail } from 'lucide-react';

function GitHubIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
      <path d="M9 18c-4.51 2-5-2-7-2" />
    </svg>
  );
}
import { useReveal } from '../lib/hooks';
import { CONTACT_EMAIL, GITHUB_URL } from '../lib/content';

export function LandingContact() {
  const [copied, setCopied] = useState(false);
  const [revealRef, visible] = useReveal<HTMLElement>();

  const copy = async (e: React.MouseEvent) => {
    e.preventDefault();
    try {
      await navigator.clipboard.writeText(CONTACT_EMAIL);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      window.location.href = `mailto:${CONTACT_EMAIL}`;
    }
  };

  return (
    <section
      id="contact"
      ref={revealRef}
      className="relative scroll-mt-20 overflow-hidden py-24 sm:py-32"
    >
      {/* Subtle radial orange glow */}
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 -z-10 h-[520px] w-[520px] -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          background:
            'radial-gradient(50% 50% at 50% 50%, rgba(232,85,0,0.18) 0%, rgba(232,85,0,0) 70%)',
        }}
        aria-hidden="true"
      />

      <div
        className="mx-auto max-w-3xl text-center"
        style={{
          opacity: visible ? 1 : 0,
          transform: visible ? 'translateY(0)' : 'translateY(24px)',
          transition: 'opacity .7s ease-out, transform .7s ease-out',
        }}
      >
        <p className="mb-4 text-xs font-bold uppercase tracking-[0.3em] text-brand-orange">
          Get in touch
        </p>
        <h2 className="text-4xl font-black leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
          <span className="text-white">Got a question?</span>
          <br />
          <span className="text-brand-orange">We read every email.</span>
        </h2>
        <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-white/55 sm:text-lg">
          Feature requests, bug reports, training feedback, or just saying hi. The fastest line to
          the team.
        </p>

        {/* Email chip */}
        <div className="mx-auto mt-10 flex max-w-md items-center justify-between gap-2 rounded-2xl border border-white/10 bg-[#0a0a0a] p-2 pl-5 transition-colors hover:border-brand-orange/40">
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            className="flex items-center gap-3 text-left text-white"
          >
            <Mail className="h-4 w-4 text-brand-orange" />
            <span className="font-mono text-sm sm:text-base">{CONTACT_EMAIL}</span>
          </a>
          <div className="flex items-center gap-1.5">
            <button
              onClick={copy}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-[#1e1e1e] text-white/70 transition-colors hover:border-white/20 hover:text-white"
              aria-label="Copy email address"
            >
              {copied ? (
                <Check className="h-4 w-4 text-brand-orange" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </button>
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="flex h-10 items-center gap-2 rounded-xl bg-brand-orange px-4 text-sm font-semibold text-white transition-colors hover:bg-[#cc4a00]"
            >
              Email us <ArrowRight className="h-4 w-4" />
            </a>
          </div>
        </div>

        {/* Side links */}
        <div className="mt-10 flex flex-wrap items-center justify-center gap-3 text-sm text-white/55">
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noreferrer noopener"
            className="flex items-center gap-2 rounded-full border border-white/10 px-4 py-2 transition-colors hover:border-white/25 hover:text-white"
          >
            <GitHubIcon className="h-4 w-4" /> GitHub
            <ArrowUpRight className="h-3.5 w-3.5 text-white/40" />
          </a>
          <span className="text-white/20">·</span>
          <span className="text-xs uppercase tracking-[0.2em] text-white/30">
            Typical reply &lt; 24h
          </span>
        </div>
      </div>
    </section>
  );
}
