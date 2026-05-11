interface AccountInfoProps {
  email: string | null;
}

export function AccountInfo({ email }: AccountInfoProps) {
  return (
    <div className="space-y-0.5">
      <p className="text-sm font-medium">{email ?? '—'}</p>
      <p className="text-xs text-muted-foreground">Signed in</p>
    </div>
  );
}
