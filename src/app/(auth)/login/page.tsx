import Link from "next/link";
import { signupState } from "@/auth/signups";
import { AuthForm } from "@/components/auth-form";
import { env } from "@/lib/env";

export default async function LoginPage() {
  const { allowed, first } = await signupState();
  return (
    <>
      <h1 className="mb-4 text-xl font-semibold">Sign in</h1>
      <AuthForm mode="login" googleLogin={env.GOOGLE_LOGIN_ENABLED && Boolean(env.GOOGLE_CLIENT_ID)} />
      {allowed && (
        <p className="mt-4 text-center text-sm text-muted-foreground">
          {first ? "New instance? " : "No account? "}
          <Link href="/signup" className="underline">
            {first ? "Set up your account" : "Create one"}
          </Link>
        </p>
      )}
    </>
  );
}
