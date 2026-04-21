/**
 * TODO(T4 — ticket:75146556-4dd0-418c-9f5e-1d0fc95d0981/38bb4604-e022-42f2-94c2-bb383d296b29):
 *   - `app/page.tsx` (`/`) and `app/plan/[slug]/**` are public routes and MUST
 *     be excluded from the auth middleware T4 introduces. Exclude them by
 *     omitting these paths from `config.matcher` in `middleware.ts` (middleware
 *     only runs on matched paths), or by using a negative-lookahead matcher that
 *     skips them. Do NOT add these paths to the matcher — that would opt them
 *     into auth checks rather than exempting them.
 *   - The session check below uses a placeholder that returns `null`; T4 must
 *     replace it with the real Supabase server-side session helper from
 *     `lib/supabase/server` and then delete `lib/auth/session.ts`.
 */

import { redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { Button } from "@/components/ui/button";
import { getCurrentSessionPlaceholder } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "LimenFit",
  description: "Fast workout logging. Soon: AI form analysis.",
};

export default async function Page() {
  const session = await getCurrentSessionPlaceholder();

  if (session !== null) {
    redirect("/home");
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-6 py-24 text-foreground">
      <h1 className="font-sans text-5xl font-semibold tracking-tight sm:text-6xl">
        LimenFit
      </h1>
      <p className="max-w-sm text-center text-muted-foreground">
        Fast workout logging. Soon: AI form analysis.
      </p>
      {/* NOTE: /auth will 404 until T4 lands */}
      <Button asChild size="lg">
        <Link href="/auth">Get Started</Link>
      </Button>
    </main>
  );
}
