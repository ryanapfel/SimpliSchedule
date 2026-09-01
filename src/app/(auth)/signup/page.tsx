import Link from "next/link";
import { redirect } from "next/navigation";
import { signupState } from "@/auth/signups";
import { AuthForm } from "@/components/auth-form";
import { env } from "@/lib/env";

export default async function SignupPage() {
  const { allowed, first } = await signupState();
  if (!allowed) redirect("/login");
  return (
    <>
      <h1 className="mb-4 text-xl font-semibold">{first ? "Set up your account" : "Create your account"}</h1>
      {first && (
        <p className="mb-4 text-sm text-muted-foreground">
          This is the first account on this instance, so it becomes the admin.
        </p>
      )}
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
