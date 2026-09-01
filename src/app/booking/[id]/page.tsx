import { eq } from "drizzle-orm";
import { formatInTimeZone } from "date-fns-tz";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { bookings } from "@/db/schema";
import { Button } from "@/components/ui/button";

export default async function BookingConfirmation({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const b = await db.query.bookings.findFirst({
    where: eq(bookings.id, id),
    with: { eventType: { with: { user: true } } },
  });
  if (!b) notFound();
  const tz = b.bookerTimezone ?? b.eventType.timezone;
  const cancelled = b.status === "cancelled";
  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/40 p-6">
      <div className="w-full max-w-md space-y-4 rounded-xl border bg-background p-6 shadow-sm">
        <h1 className="text-2xl font-semibold tracking-tight">
          {cancelled ? "This booking was cancelled" : "You're booked"}
        </h1>
        <dl className="space-y-2 text-sm">
          <Row label="What">
            {b.eventType.title} with {b.eventType.user.name}
          </Row>
          <Row label="When">
            {formatInTimeZone(b.startAt, tz, "EEEE, MMMM d, yyyy")}
            <br />
            {formatInTimeZone(b.startAt, tz, "h:mmaaa")} – {formatInTimeZone(b.endAt, tz, "h:mmaaa")} ({formatInTimeZone(b.startAt, tz, "zzz")})
          </Row>
          <Row label="Who">
            {b.bookerName} ({b.bookerEmail})
          </Row>
          {b.meetUrl && (
            <Row label="Where">
              <a href={b.meetUrl} className="underline">
                {b.meetUrl}
              </a>
            </Row>
          )}
        </dl>
        {!cancelled && (
          <p className="text-sm text-muted-foreground">
            {b.googleEventId
              ? "A calendar invitation has been sent to your email."
              : "The host has been notified."}
          </p>
        )}
        {b.eventType.user.username && (
          <Button asChild variant="outline" className="w-full">
            <Link href={`/${b.eventType.user.username}/${b.eventType.slug}`}>Book another time</Link>
          </Button>
        )}
      </div>
    </main>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[4rem_1fr] gap-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}
