import Link from 'next/link';
import { FOOTER_LINKS } from '../lib/content';

export function LandingFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-border py-12">
      <div className="grid gap-8 sm:grid-cols-2 md:grid-cols-4">
        {FOOTER_LINKS.map((group) => (
          <div key={group.label} className="space-y-3">
            <p className="text-sm font-semibold text-foreground">{group.label}</p>
            <ul className="space-y-2">
              {group.links.map((link) => (
                <li key={link.href + link.label}>
                  {link.external ? (
                    <a
                      href={link.href}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {link.label}
                    </a>
                  ) : (
                    // TODO: replace # hrefs with real routes once Privacy/Terms pages exist
                    <Link
                      href={link.href}
                      className="text-sm text-muted-foreground transition-colors hover:text-foreground"
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
      <p className="mt-10 text-center text-xs text-muted-foreground">
        © {year} LimenFit. All rights reserved.
      </p>
    </footer>
  );
}
