import Image from 'next/image';
import Link from 'next/link';
import { CONTACT_EMAIL, FOOTER_LINKS, GITHUB_URL } from '../lib/content';

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

function MailIcon({ className }: { className?: string }) {
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
      <rect width="20" height="16" x="2" y="4" rx="2" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </svg>
  );
}

export function LandingFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-white/[0.08] py-14">
      <div className="grid gap-10 lg:grid-cols-[1.2fr_2fr] lg:gap-16">
        {/* Left: wordmark + tagline + social icons */}
        <div>
          <Link href="/" className="flex items-center gap-2 text-white">
            <Image src="/icon.png" alt="LimenFit logo" width={24} height={24} />
            <span className="text-base font-bold uppercase tracking-[0.2em]">LimenFit</span>
          </Link>
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-white/45">
            The fastest way to log a set. Built for lifters. Backed by tech.
          </p>
          <div className="mt-5 flex items-center gap-2">
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noreferrer noopener"
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 text-white/60 transition-colors hover:border-white/25 hover:text-white"
              aria-label="GitHub"
            >
              <GitHubIcon className="h-4 w-4" />
            </a>
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 text-white/60 transition-colors hover:border-white/25 hover:text-white"
              aria-label="Email"
            >
              <MailIcon className="h-4 w-4" />
            </a>
          </div>
        </div>

        {/* Right: 4 link columns */}
        <div className="grid gap-8 sm:grid-cols-2 md:grid-cols-4">
          {FOOTER_LINKS.map((group) => (
            <div key={group.label} className="space-y-3">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/40">
                {group.label}
              </p>
              <ul className="space-y-2">
                {group.links.map((link) => (
                  <li key={link.href + link.label}>
                    {link.external ? (
                      <a
                        href={link.href}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="text-sm text-white/70 transition-colors hover:text-brand-orange"
                      >
                        {link.label}
                      </a>
                    ) : (
                      <Link
                        href={link.href}
                        className="text-sm text-white/70 transition-colors hover:text-brand-orange"
                      >
                        {link.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom bar */}
      <div className="mt-12 flex flex-col items-center justify-between gap-3 border-t border-white/[0.06] pt-6 sm:flex-row">
        <p className="text-xs text-white/35">© {year} LimenFit. All rights reserved.</p>
        <p className="text-xs uppercase tracking-[0.2em] text-white/30">
          Less friction. More progress.
        </p>
      </div>
    </footer>
  );
}
