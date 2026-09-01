import Link from "next/link";
import { AuthForm } from "@/components/auth-form";
import { env } from "@/lib/env";

export default function LoginPage() {
  return (
    <>
      <h1 className="mb-4 text-xl font-semibold">Sign in</h1>
      <AuthForm mode="login" googleLogin={env.GOOGLE_LOGIN_ENABLED && Boolean(env.GOOGLE_CLIENT_ID)} />
      <p className="mt-4 text-center text-sm text-muted-foreground">
        No account?{" "}
        <Link href="/signup" className="underline">
          Create one
        </Link>
      </p>
    </>
  );
}
