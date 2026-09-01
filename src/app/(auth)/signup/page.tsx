import Link from "next/link";
import { AuthForm } from "@/components/auth-form";
import { env } from "@/lib/env";

export default function SignupPage() {
  return (
    <>
      <h1 className="mb-4 text-xl font-semibold">Create your account</h1>
      <AuthForm mode="signup" googleLogin={env.GOOGLE_LOGIN_ENABLED && Boolean(env.GOOGLE_CLIENT_ID)} />
      <p className="mt-4 text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/login" className="underline">
          Sign in
        </Link>
      </p>
    </>
  );
}
