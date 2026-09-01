import { format } from "date-fns";
import { eq } from "drizzle-orm";
import { CircleCheckIcon, TriangleAlertIcon } from "lucide-react";
import { requireUser } from "@/auth/session";
import {
  ConflictSwitch,
  DisconnectButton,
  ResyncButton,
} from "@/components/dashboard/calendar-actions";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/db";
import { calendarAccounts } from "@/db/schema";
import { googleConfigured } from "@/lib/google/oauth";

const ERRORS: Record<string, string> = {
  google_not_configured: "Google isn't configured on this instance yet.",
  google_denied: "You declined the Google permission request.",
  invalid_state: "That connect link expired. Please try again.",
  no_profile: "Google didn't return an email address for that account.",
  no_refresh_token:
    "Google didn't return a refresh token. Remove this app at myaccount.google.com/permissions and connect again.",
};

export default async function CalendarsPage({
  searchParams,
}: {
  searchParams: Promise<{ connected?: string; error?: string }>;
}) {
  const { connected, error } = await searchParams;
  const me = await requireUser();
  const accounts = await db.query.calendarAccounts.findMany({
    where: eq(calendarAccounts.userId, me.id),
    with: { calendars: { orderBy: (t, { desc, asc }) => [desc(t.isPrimary), asc(t.name)] } },
    orderBy: (t, { asc }) => asc(t.createdAt),
  });

  const configured = googleConfigured();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Calendars</h1>
        <p className="text-sm text-muted-foreground">
          Busy time on the calendars you check for conflicts blocks bookable slots.
        </p>
      </div>

      {connected === "1" && (
        <Alert>
          <CircleCheckIcon />
          <AlertTitle>Google account connected</AlertTitle>
          <AlertDescription>Its calendars are listed below.</AlertDescription>
        </Alert>
      )}

      {error && (
        <Alert variant="destructive">
          <TriangleAlertIcon />
          <AlertTitle>Couldn&apos;t connect</AlertTitle>
          <AlertDescription>{ERRORS[error] ?? "Something went wrong."}</AlertDescription>
        </Alert>
      )}

      {!configured && (
        <Alert variant="destructive">
          <TriangleAlertIcon />
          <AlertTitle>Google isn&apos;t configured</AlertTitle>
          <AlertDescription>
            Set <code className="font-mono">GOOGLE_CLIENT_ID</code> and{" "}
            <code className="font-mono">GOOGLE_CLIENT_SECRET</code> in <code className="font-mono">.env</code>{" "}
            and restart the server to connect calendars.
          </AlertDescription>
        </Alert>
      )}

      {configured ? (
        <Button asChild>
          {/* An API route, not a page: it needs a real navigation so Google can redirect back. */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a href="/api/google/connect">Connect Google account</a>
        </Button>
      ) : (
        <Button disabled>Connect Google account</Button>
      )}

      {accounts.length === 0 ? (
        <Card>
          <CardContent className="py-10">
            <p className="text-sm text-muted-foreground">
              No calendar accounts connected. Bookings won&apos;t create calendar events until you connect one.
            </p>
          </CardContent>
        </Card>
      ) : (
        accounts.map((account) => (
          <Card key={account.id}>
            <CardHeader>
              <CardTitle>{account.email}</CardTitle>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-muted-foreground">
                  Connected {format(account.createdAt, "MMM d, yyyy")}
                </span>
                <ResyncButton accountId={account.id} />
                <DisconnectButton accountId={account.id} email={account.email} />
              </div>
            </CardHeader>
            <CardContent>
              {account.calendars.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No calendars synced yet — try &ldquo;Re-sync calendars&rdquo;.
                </p>
              ) : (
                <ul className="divide-y">
                  {account.calendars.map((cal) => (
                    <li key={cal.id} className="flex flex-wrap items-center justify-between gap-3 py-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm">{cal.name}</span>
                        {cal.isPrimary && <Badge variant="outline">primary</Badge>}
                      </div>
                      <ConflictSwitch calendarId={cal.id} enabled={cal.checkForConflicts} />
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
