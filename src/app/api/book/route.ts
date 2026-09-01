import { NextResponse } from "next/server";
import { z } from "zod";
import { createBooking, eventTypeBySlug, SlotUnavailableError } from "@/lib/booking";

const body = z.object({
  username: z.string(),
  slug: z.string(),
  start: z.coerce.date(),
  name: z.string().trim().min(1).max(200),
  email: z.string().trim().email(),
  notes: z.string().trim().max(2000).optional(),
  timezone: z.string().optional(),
});

/** Public: create a booking. Returns { id } for the confirmation page. */
export async function POST(req: Request) {
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Please check the form." }, { status: 400 });
  const { username, slug, ...rest } = parsed.data;
  const found = await eventTypeBySlug(username, slug);
  if (!found) return NextResponse.json({ error: "Not found" }, { status: 404 });
  try {
    const booking = await createBooking({ eventType: found.eventType, ...rest });
    return NextResponse.json({ id: booking.id });
  } catch (err) {
    if (err instanceof SlotUnavailableError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    console.error("booking failed", err);
    return NextResponse.json({ error: "Booking failed. Please try again." }, { status: 500 });
  }
}
