import { NextResponse } from "next/server";
import { z } from "zod";
import { eventTypeBySlug, openSlots } from "@/lib/booking";

const query = z.object({
  username: z.string(),
  slug: z.string(),
  start: z.coerce.date(),
  end: z.coerce.date(),
});

/** Public: open slots for a booking page. GET /api/slots?username=&slug=&start=ISO&end=ISO */
export async function GET(req: Request) {
  const parsed = query.safeParse(Object.fromEntries(new URL(req.url).searchParams));
  if (!parsed.success) return NextResponse.json({ error: "Bad request" }, { status: 400 });
  const { username, slug, start, end } = parsed.data;
  const found = await eventTypeBySlug(username, slug);
  if (!found) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { slots } = await openSlots(found.eventType, { start, end });
  return NextResponse.json({ slots: slots.map((s) => s.start.toISOString()) });
}
