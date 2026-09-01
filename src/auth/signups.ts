import { count, eq } from "drizzle-orm";
import { db } from "@/db";
import { appSettings, user } from "@/db/schema";
import { env } from "@/lib/env";

/**
 * Whether a new account may be created right now.
 * The first account is always allowed (it bootstraps the instance and becomes admin). After that,
 * SINGLE_USER=true locks signups permanently; otherwise the admin's "signups open" switch decides.
 */
export async function signupState(): Promise<{ allowed: boolean; first: boolean }> {
  const [{ value: total }] = await db.select({ value: count() }).from(user);
  if (total === 0) return { allowed: true, first: true };
  if (env.SINGLE_USER) return { allowed: false, first: false };
  const row = await db.query.appSettings.findFirst({ where: eq(appSettings.id, "default") });
  return { allowed: row?.signupsOpen ?? true, first: false };
}
