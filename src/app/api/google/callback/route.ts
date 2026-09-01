import { NextResponse } from "next/server";
import { google } from "googleapis";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { calendarAccounts } from "@/db/schema";
import { encrypt } from "@/lib/crypto";
import { env } from "@/lib/env";
import { newId } from "@/lib/ids";
import { syncCalendars } from "@/lib/google/calendar";
import { newOAuthClient } from "@/lib/google/oauth";
import { decodeState } from "@/lib/google/state";

const back = (q: string) => NextResponse.redirect(`${env.APP_URL}/dashboard/calendars?${q}`);

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = decodeState(url.searchParams.get("state") ?? "");
  if (url.searchParams.get("error")) return back("error=google_denied");
  if (!code || !state) return back("error=invalid_state");

  const client = newOAuthClient();
  const { tokens } = await client.getToken(code);
  client.setCredentials(tokens);
  const { data: me } = await google.oauth2({ version: "v2", auth: client }).userinfo.get();
  if (!me.id || !me.email) return back("error=no_profile");

  const existing = await db.query.calendarAccounts.findFirst({
    where: and(
      eq(calendarAccounts.userId, state.userId),
      eq(calendarAccounts.provider, "google"),
      eq(calendarAccounts.providerAccountId, me.id),
    ),
  });
  // Google only returns a refresh token on first consent (we force prompt=consent, but be safe).
  if (!tokens.refresh_token && !existing) return back("error=no_refresh_token");

  const values = {
    email: me.email,
    refreshTokenEnc: tokens.refresh_token ? encrypt(tokens.refresh_token) : existing!.refreshTokenEnc,
    accessTokenEnc: tokens.access_token ? encrypt(tokens.access_token) : null,
    accessTokenExpiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
    scope: tokens.scope ?? null,
    updatedAt: new Date(),
  };
  let account;
  if (existing) {
    [account] = await db
      .update(calendarAccounts)
      .set(values)
      .where(eq(calendarAccounts.id, existing.id))
      .returning();
  } else {
    [account] = await db
      .insert(calendarAccounts)
      .values({ id: newId(), userId: state.userId, provider: "google", providerAccountId: me.id, ...values })
      .returning();
  }
  await syncCalendars(account);
  return back("connected=1");
}
