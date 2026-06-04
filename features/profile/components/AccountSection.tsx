import { ChangePasswordRow } from './ChangePasswordRow';
import { DeleteAccountDialog } from './DeleteAccountDialog';

interface AccountSectionProps {
  email: string | null;
}

export function AccountSection({ email }: AccountSectionProps) {
  return (
    <section aria-labelledby="profile-account-heading" className="space-y-6">
      <div className="space-y-1">
        <h2 id="profile-account-heading" className="text-2xl font-semibold tracking-tight">
          Account
        </h2>
        <p className="text-sm text-muted-foreground">Manage credentials and your data.</p>
      </div>
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
