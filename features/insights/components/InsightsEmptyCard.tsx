interface Props {
  message?: string;
}

export function InsightsEmptyCard({ message = 'Keep logging to unlock insights' }: Props) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}
