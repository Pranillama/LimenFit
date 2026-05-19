'use client';

interface Props {
  reset: () => void;
}

export default function HomeError({ reset }: Props) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
      <p className="text-base font-medium text-foreground">Couldn&apos;t load Home</p>
      <p className="text-sm text-muted-foreground">Something went wrong fetching your dashboard.</p>
      <button
        onClick={reset}
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
      >
        Try again
      </button>
    </div>
  );
}
