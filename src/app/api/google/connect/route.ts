import { NextResponse } from "next/server";
import { getSession } from "@/auth/session";
import { connectUrl, googleConfigured } from "@/lib/google/oauth";
import { encodeState } from "@/lib/google/state";
import { env } from "@/lib/env";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.redirect(`${env.APP_URL}/login`);
  if (!googleConfigured()) {
    return NextResponse.redirect(`${env.APP_URL}/dashboard/calendars?error=google_not_configured`);
  }
  return NextResponse.redirect(connectUrl(encodeState(session.user.id)));
}
