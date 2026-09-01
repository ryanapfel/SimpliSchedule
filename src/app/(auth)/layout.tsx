import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/auth/session";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  if (await getSession()) redirect("/dashboard");
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted/40 p-6">
      <Link href="/" className="mb-6 text-lg font-semibold">
        Scheduling
      </Link>
      <div className="w-full max-w-sm rounded-xl border bg-background p-6 shadow-sm">{children}</div>
    </div>
  );
}
