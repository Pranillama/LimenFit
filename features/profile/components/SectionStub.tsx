import * as React from 'react';

interface SectionStubProps {
  title: string;
  description: string;
}

export function SectionStub({ title, description }: SectionStubProps) {
  return (
    <section className="rounded-xl border border-dashed border-border bg-card p-8 text-center">
      <h1 className="text-lg font-semibold">{title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{description}</p>
      <p className="mt-4 text-xs text-muted-foreground">Coming soon</p>
    </section>
  );
}
