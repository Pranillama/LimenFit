'use client';

import { Lock, Mail } from 'lucide-react';

import { useChangePassword } from '../hooks/useChangePassword';

interface ChangePasswordRowProps {
  email: string | null;
}

export function ChangePasswordRow({ email }: ChangePasswordRowProps) {
  const { send, isSending } = useChangePassword();
  return (
    <div className="rounded-xl border border-border bg-card">
      <button
        type="button"
        onClick={() => void send(email)}
        disabled={isSending}
        className="flex w-full min-h-[3.25rem] items-center gap-3 rounded-xl px-4 py-3 transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-60"
      >
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-secondary text-muted-foreground">
          <Lock className="h-4 w-4" />
        </span>
        <span className="flex min-w-0 flex-1 flex-col text-left">
          <span className="truncate text-sm font-medium">Change password</span>
          <span className="truncate text-xs text-muted-foreground">
            {isSending ? 'Sending reset link…' : 'We will email a secure reset link'}
          </span>
        </span>
      </button>
      <div className="flex items-center gap-3 border-t border-border px-4 py-3">
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-secondary text-muted-foreground">
          <Mail className="h-4 w-4" />
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-sm font-medium">{email ?? '—'}</span>
          <span className="truncate text-xs text-muted-foreground">Verified</span>
        </span>
      </div>
    </div>
  );
}
