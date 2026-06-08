import { Camera } from 'lucide-react';

export function ProgressPhotosPlaceholder() {
  return (
    <section>
      <h2 className="mb-3 text-lg font-semibold">Progress photos</h2>
      <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border bg-card px-6 py-12 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-secondary text-muted-foreground">
          <Camera className="h-5 w-5" />
        </span>
        <p className="text-base font-medium">Visual progress timeline</p>
        <p className="text-sm text-muted-foreground">
          Track changes with side-by-side photos over time.
        </p>
        <span className="rounded-full bg-brand/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-brand">
          Coming soon
        </span>
      </div>
    </section>
  );
}
