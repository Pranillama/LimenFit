import { ChangePasswordRow } from './ChangePasswordRow';
import { DeleteAccountDialog } from './DeleteAccountDialog';

interface AccountSectionProps {
  email: string | null;
}

export function AccountSection({ email }: AccountSectionProps) {
  return (
    <section aria-labelledby="profile-account-heading" className="space-y-4">
      <h2
        id="profile-account-heading"
        className="text-xs font-semibold uppercase tracking-widest text-muted-foreground"
      >
        Account
      </h2>
      <ChangePasswordRow email={email} />
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-widest text-destructive">
          Danger zone
        </p>
        <DeleteAccountDialog />
      </div>
    </section>
  );
}
