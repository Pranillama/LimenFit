import { LandingHeader } from './components/LandingHeader';
import { LandingHero } from './components/LandingHero';
import { LandingFeatures } from './components/LandingFeatures';
import { LandingWhyLimenFit } from './components/LandingWhyLimenFit';
import { LandingContact } from './components/LandingContact';
import { LandingFooter } from './components/LandingFooter';
import { MotionSection } from './components/MotionSection';

export function LandingPage() {
  return (
    <div className="min-h-screen bg-black text-white">
      <LandingHeader />
      {/* Hero is full-width — lives outside the max-w container */}
      <LandingHero />
      {/* Orange divider between hero and features */}
      <div className="h-px w-full bg-gradient-to-r from-transparent via-brand-orange to-transparent opacity-60" />
      <div className="mx-auto max-w-screen-xl px-4 sm:px-6">
        <MotionSection>
          <LandingFeatures />
        </MotionSection>
      </div>
      {/* Why is full-width so the PROGRESS. display word
          overflows symmetrically and the parallax spans the viewport */}
      <LandingWhyLimenFit />
      <div className="mx-auto max-w-screen-xl px-4 sm:px-6">
        <LandingContact />
        <LandingFooter />
      </div>
    </div>
  );
}
