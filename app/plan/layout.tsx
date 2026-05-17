import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'LimenFit',
  description: 'Public training plan on LimenFit',
};

export default function PublicPlanLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="border-b">
        <div className="container mx-auto flex w-full max-w-2xl items-center justify-between px-4 py-3 md:max-w-3xl md:px-6">
          <Link
            href="/"
            className="text-lg font-semibold tracking-tight"
            aria-label="LimenFit home"
          >
            LimenFit
          </Link>
        </div>
      </header>
      <main className="flex-1">
        <div className="container mx-auto w-full max-w-2xl px-4 py-6 md:max-w-3xl md:px-6 md:py-8">
          {children}
        </div>
      </main>
      <footer className="border-t">
        <div className="container mx-auto w-full max-w-2xl px-4 py-4 text-center text-xs text-muted-foreground md:max-w-3xl md:px-6">
          © LimenFit
        </div>
      </footer>
    </div>
  );
}
