import { addDays } from "date-fns";
import { and, eq, or } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { eventTypes } from "@/db/schema";
import { userIdFromRequest } from "@/auth/session";
import { formatAvailabilityHtml, formatAvailabilityText } from "@/lib/availability/text";
import { bookingUrl, openSlots } from "@/lib/booking";

/**
 * GET /api/availability/text?eventType=<slug|id>&days=5&tz=America/Los_Angeles
 * Auth: session cookie, or `Authorization: Bearer sched_…` (API key, used by Raycast).
 * Returns plain text ready to paste into an email. `&format=html` links each time block to the booking
 * page for that block; `&format=json` returns slots + text + html.
 */
export async function GET(req: Request) {
  const userId = await userIdFromRequest(req);
  if (!userId) return new NextResponse("Unauthorized", { status: 401 });

  const q = new URL(req.url).searchParams;
  const key = q.get("eventType");
  const days = Math.min(Math.max(Number(q.get("days") ?? 5), 1), 30);
  const tz = q.get("tz") ?? undefined;

  const et = await db.query.eventTypes.findFirst({
    where: and(
      eq(eventTypes.userId, userId),
      eq(eventTypes.active, true),
      ...(key ? [or(eq(eventTypes.slug, key), eq(eventTypes.id, key), eq(eventTypes.shortCode, key))] : []),
    ),
    orderBy: (t, { asc }) => [asc(t.createdAt)],
  });
  if (!et) return new NextResponse("Booking link not found", { status: 404 });

  const now = new Date();
  const { slots, errors } = await openSlots(et, { start: now, end: addDays(now, days) }, now);
  const fmt = { slots, timezone: tz ?? et.timezone, bookingUrl: bookingUrl(et) };
  const text = formatAvailabilityText(fmt);

  // `html` links every time block to the booking page with that day/block preselected.
  const format = q.get("format");
  if (format === "html") {
    return new NextResponse(formatAvailabilityHtml(fmt), {
      headers: { "content-type": "text/html; charset=utf-8", "x-calendar-errors": String(errors.length) },
    });
  }
  if (format === "json") {
    const html = formatAvailabilityHtml(fmt);
    return NextResponse.json({ text, html, slots, errors, eventType: { id: et.id, slug: et.slug, title: et.title } });
  }
  return new NextResponse(text, {
    headers: { "content-type": "text/plain; charset=utf-8", "x-calendar-errors": String(errors.length) },
  });
}
