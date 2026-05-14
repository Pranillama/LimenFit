import { WHY_LIMENFIT } from '../lib/content';

export function LandingWhyLimenFit() {
  return (
    <section className="py-16">
      <div className="mx-auto max-w-2xl space-y-4 text-center">
        <h2 className="text-3xl font-semibold tracking-tight">{WHY_LIMENFIT.heading}</h2>
        <p className="text-muted-foreground">{WHY_LIMENFIT.pain}</p>
        <p className="text-muted-foreground">{WHY_LIMENFIT.success}</p>
      </div>
    </section>
  );
}
