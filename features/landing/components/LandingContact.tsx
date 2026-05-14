import { Button } from '@/components/ui/button';
import { CONTACT, CONTACT_EMAIL } from '../lib/content';

export function LandingContact() {
  return (
    <section className="py-16 text-center">
      <div className="mx-auto max-w-md space-y-4">
        <h2 className="text-3xl font-semibold tracking-tight">{CONTACT.heading}</h2>
        <p className="text-muted-foreground">{CONTACT.body}</p>
        <Button asChild variant="outline">
          <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT.cta}</a>
        </Button>
      </div>
    </section>
  );
}
