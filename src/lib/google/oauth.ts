import { google } from "googleapis";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { calendarAccounts, type CalendarAccount } from "@/db/schema";
import { decrypt, encrypt } from "@/lib/crypto";
import { env } from "@/lib/env";

export const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/userinfo.email",
  "openid",
];

export const GOOGLE_REDIRECT_URI = `${env.APP_URL}/api/google/callback`;

export function googleConfigured() {
  return Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
}

export function newOAuthClient() {
  return new google.auth.OAuth2(env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI);
}

export function connectUrl(state: string) {
  return newOAuthClient().generateAuthUrl({
    access_type: "offline",
    prompt: "consent select_account",
    include_granted_scopes: true,
    scope: GOOGLE_SCOPES,
    state,
  });
}

/** Authorized client for a stored account; persists refreshed access tokens. */
export function clientForAccount(account: CalendarAccount) {
  const client = newOAuthClient();
  client.setCredentials({
    refresh_token: decrypt(account.refreshTokenEnc),
    access_token: account.accessTokenEnc ? decrypt(account.accessTokenEnc) : undefined,
    expiry_date: account.accessTokenExpiresAt?.getTime(),
  });
  client.on("tokens", async (tokens) => {
    await db
      .update(calendarAccounts)
      .set({
        accessTokenEnc: tokens.access_token ? encrypt(tokens.access_token) : undefined,
        accessTokenExpiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : undefined,
        refreshTokenEnc: tokens.refresh_token ? encrypt(tokens.refresh_token) : undefined,
        updatedAt: new Date(),
      })
      .where(eq(calendarAccounts.id, account.id));
  });
  return client;
}
