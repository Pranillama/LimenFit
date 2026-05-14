'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { FEATURES, type FeatureIllustration } from '../lib/content';
import { FastLoggingIllustration } from './illustrations/FastLoggingIllustration';
import { OfflineIllustration } from './illustrations/OfflineIllustration';
import { PlanShareIllustration } from './illustrations/PlanShareIllustration';
import { AnalyzeIllustration } from './illustrations/AnalyzeIllustration';

const ILLUSTRATION_MAP: Record<FeatureIllustration, React.ComponentType> = {
  'fast-logging': FastLoggingIllustration,
  offline: OfflineIllustration,
  'plan-share': PlanShareIllustration,
  analyze: AnalyzeIllustration,
};

const DELAYS = [0, 0.08, 0.16, 0.24];

export function LandingFeatureGrid() {
  const shouldReduce = useReducedMotion();

  return (
    <div className="grid gap-6 md:grid-cols-2">
      {FEATURES.map((feature, i) => {
        const Illustration = ILLUSTRATION_MAP[feature.illustration];
        const cardContent = (
          <>
            <div className="mb-4 flex h-20 w-full items-center justify-center rounded-lg bg-muted">
              <Illustration />
            </div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold">{feature.title}</h3>
              {feature.comingSoon && (
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                  Coming soon
                </span>
              )}
            </div>
            <p className="mt-2 text-sm text-muted-foreground">{feature.description}</p>
          </>
        );

        if (shouldReduce) {
          return (
            <div key={feature.id} className="rounded-xl border border-border bg-card p-6 shadow-sm">
              {cardContent}
            </div>
          );
        }

        return (
          <motion.div
            key={feature.id}
            className="rounded-xl border border-border bg-card p-6 shadow-sm"
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.45, ease: 'easeOut', delay: DELAYS[i] }}
          >
            {cardContent}
          </motion.div>
        );
      })}
    </div>
  );
}
