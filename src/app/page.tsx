import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/auth/session";
import { signupState } from "@/auth/signups";
import { Button } from "@/components/ui/button";

export default async function Home() {
  if (await getSession()) redirect("/dashboard");
  const { allowed } = await signupState();
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-6 text-center">
      <h1 className="text-3xl font-semibold tracking-tight">Scheduling</h1>
      <p className="max-w-md text-muted-foreground">
        Self-hosted booking links across all of your Google calendars, with availability you can paste
        straight into an email.
      </p>
      <div className="flex gap-3">
        <Button asChild>
          <Link href="/login">Sign in</Link>
        </Button>
        {allowed && (
          <Button asChild variant="outline">
            <Link href="/signup">Create account</Link>
          </Button>
        )}
      </div>
    </main>
  );
}
