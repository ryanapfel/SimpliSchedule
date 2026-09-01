import { and, eq, gte } from "drizzle-orm";
import { formatInTimeZone } from "date-fns-tz";
import Link from "next/link";
import { requireUser } from "@/auth/session";
import { db } from "@/db";
import { bookings, calendarAccounts, eventTypes } from "@/db/schema";
import { CopyAvailability } from "@/components/copy-availability";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function Overview() {
  const me = await requireUser();
  const tz = me.timezone ?? "UTC";
  const [types, accounts, upcoming] = await Promise.all([
    db.query.eventTypes.findMany({
      where: and(eq(eventTypes.userId, me.id), eq(eventTypes.active, true)),
      orderBy: (t, { asc }) => [asc(t.createdAt)],
      columns: { id: true, title: true, slug: true },
    }),
    db.query.calendarAccounts.findMany({ where: eq(calendarAccounts.userId, me.id) }),
    db.query.bookings.findMany({
      where: and(eq(bookings.userId, me.id), eq(bookings.status, "confirmed"), gte(bookings.startAt, new Date())),
      orderBy: (b, { asc }) => [asc(b.startAt)],
      limit: 5,
      with: { eventType: { columns: { title: true } } },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Overview</h1>
        <p className="text-sm text-muted-foreground">
          {accounts.length === 0
            ? "Connect a Google account so busy time blocks your booking slots."
            : `${accounts.length} connected ${accounts.length === 1 ? "account" : "accounts"} · ${types.length} active ${types.length === 1 ? "booking link" : "booking links"}`}
        </p>
      </div>

      {accounts.length === 0 && (
        <Button asChild variant="outline">
          <Link href="/dashboard/calendars">Connect Google account</Link>
        </Button>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Copy availability</CardTitle>
          <CardDescription>
            Paste this into an email. The same text is available from Raycast via your API key.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CopyAvailability eventTypes={types} defaultTimezone={tz} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Upcoming bookings</CardTitle>
        </CardHeader>
        <CardContent>
          {upcoming.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing booked yet.</p>
          ) : (
            <ul className="divide-y text-sm">
              {upcoming.map((b) => (
                <li key={b.id} className="flex flex-wrap justify-between gap-2 py-2">
                  <span>
                    <span className="font-medium">{b.bookerName}</span> · {b.eventType.title}
                  </span>
                  <span className="text-muted-foreground">
                    {formatInTimeZone(b.startAt, tz, "EEE, MMM d · h:mmaaa")}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <Button asChild variant="link" className="mt-2 px-0">
            <Link href="/dashboard/bookings">All bookings</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
