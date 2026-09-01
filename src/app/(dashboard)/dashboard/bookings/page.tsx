import { formatInTimeZone } from "date-fns-tz";
import { and, eq, gte, lt, ne, or } from "drizzle-orm";
import { requireUser } from "@/auth/session";
import { CancelBookingButton } from "@/components/dashboard/cancel-booking-button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { db } from "@/db";
import { bookings } from "@/db/schema";

const WHEN = "EEE, MMM d · h:mmaaa";

type Row = {
  id: string;
  startAt: Date;
  bookerName: string;
  bookerEmail: string;
  status: "confirmed" | "cancelled";
  meetUrl: string | null;
  eventType: { title: string };
};

export default async function BookingsPage() {
  const me = await requireUser();
  const now = new Date();
  const withEventType = { eventType: { columns: { title: true } } } as const;

  const [upcoming, past] = await Promise.all([
    db.query.bookings.findMany({
      where: and(
        eq(bookings.userId, me.id),
        eq(bookings.status, "confirmed"),
        gte(bookings.startAt, now),
      ),
      with: withEventType,
      orderBy: (t, { asc }) => asc(t.startAt),
    }),
    db.query.bookings.findMany({
      where: and(
        eq(bookings.userId, me.id),
        or(ne(bookings.status, "confirmed"), lt(bookings.startAt, now)),
      ),
      with: withEventType,
      orderBy: (t, { desc }) => desc(t.startAt),
      limit: 50,
    }),
  ]);

  const timezone = me.timezone ?? "UTC";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Bookings</h1>
        <p className="text-sm text-muted-foreground">Times shown in {timezone}.</p>
      </div>

      <Section title="Upcoming" rows={upcoming} timezone={timezone} cancellable empty="No upcoming bookings." />
      <Section title="Past and cancelled" rows={past} timezone={timezone} empty="Nothing here yet." />
    </div>
  );
}

function Section({
  title,
  rows,
  timezone,
  cancellable = false,
  empty,
}: {
  title: string;
  rows: Row[];
  timezone: string;
  cancellable?: boolean;
  empty: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className={rows.length === 0 ? undefined : "px-0"}>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">{empty}</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>Booker</TableHead>
                <TableHead>Booking link</TableHead>
                <TableHead>Status</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((b) => {
                const when = formatInTimeZone(b.startAt, timezone, WHEN);
                return (
                  <TableRow key={b.id}>
                    <TableCell className="font-medium whitespace-nowrap">{when}</TableCell>
                    <TableCell>
                      <div>{b.bookerName}</div>
                      <p className="text-xs text-muted-foreground">{b.bookerEmail}</p>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{b.eventType.title}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={b.status === "confirmed" ? "secondary" : "destructive"}>
                          {b.status}
                        </Badge>
                        {b.meetUrl && (
                          <a
                            href={b.meetUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs underline underline-offset-3"
                          >
                            Meet
                          </a>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      {cancellable && <CancelBookingButton id={b.id} when={when} />}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
