import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { auth } from "./server";

export const getSession = cache(async () => auth.api.getSession({ headers: await headers() }));

/** Redirects to /login when unauthenticated. Use in dashboard pages and server actions. */
export async function requireUser() {
  const session = await getSession();
  if (!session) redirect("/login");
  return session.user;
}

export async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== "admin") redirect("/dashboard");
  return user;
}

/** Resolves the acting user from a session cookie or an `Authorization: Bearer sched_…` API key. */
export async function userIdFromRequest(req: Request): Promise<string | null> {
  const authz = req.headers.get("authorization");
  if (authz?.toLowerCase().startsWith("bearer ")) {
    const { findUserIdByApiKey } = await import("@/lib/api-keys");
    return findUserIdByApiKey(authz.slice(7).trim());
  }
  const session = await auth.api.getSession({ headers: req.headers });
  return session?.user.id ?? null;
}
