import { LandingHeader } from './components/LandingHeader';
import { LandingHero } from './components/LandingHero';
import { LandingFeatures } from './components/LandingFeatures';
import { LandingWhyLimenFit } from './components/LandingWhyLimenFit';
import { LandingContact } from './components/LandingContact';
import { LandingFooter } from './components/LandingFooter';

export function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <LandingHeader />
      <main className="max-w-6xl mx-auto px-6">
        <LandingHero />
        <LandingFeatures />
        <LandingWhyLimenFit />
        <LandingContact />
      </main>
      <div className="max-w-6xl mx-auto px-6">
        <LandingFooter />
      </div>
    </div>
  );
}
