import { FEATURES } from '../lib/content';

export function LandingFeatures() {
  return (
    <section id="features" className="py-16">
      <h2 className="mb-10 text-center text-3xl font-semibold tracking-tight">
        Everything you need. Nothing you don&apos;t.
      </h2>
      <div className="grid gap-6 md:grid-cols-2">
        {FEATURES.map((feature) => (
          <div
            key={feature.id}
            className="rounded-xl border border-border bg-card p-6 shadow-sm"
          >
            {/* Illustration slot — Phase B will mount SVG here */}
            <div
              data-slot={`feature-illustration-${feature.illustration}`}
              className="mb-4 h-20 w-full rounded-lg bg-muted"
            />
            <div className="flex items-center gap-2">
              <h3 className="font-semibold">{feature.title}</h3>
              {feature.comingSoon && (
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                  Coming soon
                </span>
              )}
            </div>
            <p className="mt-2 text-sm text-muted-foreground">{feature.description}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
