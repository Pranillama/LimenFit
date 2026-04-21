import { redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { Button } from "@/components/ui/button";
import { createSupabaseServerClient } from "@/lib/supabase/server-exports";

export const metadata: Metadata = {
  title: "LimenFit",
  description: "Fast workout logging. Soon: AI form analysis.",
};

export default async function Page() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
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
      <Button asChild size="lg">
        <Link href="/auth">Get Started</Link>
      </Button>
    </main>
  );
}
