import { addDays, addMinutes } from "date-fns";
import { and, eq, gte, lt } from "drizzle-orm";
import { db } from "@/db";
import { bookings, eventTypes, user, type EventType } from "@/db/schema";
import { availabilityWindows } from "@/lib/availability/schedule";
import { computeSlots } from "@/lib/availability/slots";
import type { Interval } from "@/lib/availability/types";
import { busyIntervals, calendarWithAccount, insertEvent } from "@/lib/google/calendar";
import { newId } from "@/lib/ids";
import { env } from "@/lib/env";

export async function eventTypeBySlug(username: string, slug: string) {
  const owner = await db.query.user.findFirst({ where: eq(user.username, username) });
  if (!owner) return null;
  const et = await db.query.eventTypes.findFirst({
    where: and(eq(eventTypes.userId, owner.id), eq(eventTypes.slug, slug), eq(eventTypes.active, true)),
  });
  return et ? { eventType: et, owner } : null;
}

export async function eventTypeByShortCode(code: string) {
  return db.query.eventTypes.findFirst({
    where: and(eq(eventTypes.shortCode, code), eq(eventTypes.active, true)),
    with: { user: true },
  });
}

export function bookingUrl(et: EventType) {
  return `${env.APP_URL}/b/${et.shortCode}`;
}

/** Bookable window for an event type: from now until maxDaysAhead. */
export function bookableRange(et: EventType, now = new Date()): Interval {
  return { start: now, end: addDays(now, et.maxDaysAhead) };
}

export async function existingBookings(userId: string, range: Interval): Promise<Interval[]> {
  const rows = await db.query.bookings.findMany({
    where: and(
      eq(bookings.userId, userId),
      eq(bookings.status, "confirmed"),
      lt(bookings.startAt, range.end),
      gte(bookings.endAt, range.start),
    ),
    columns: { startAt: true, endAt: true },
  });
  return rows.map((r) => ({ start: r.startAt, end: r.endAt }));
}

/** Open slots for an event type within `range`, honoring calendars, bookings, buffers and notice. */
export async function openSlots(et: EventType, range: Interval, now = new Date()) {
  const bookable = bookableRange(et, now);
  const clipped: Interval = {
    start: new Date(Math.max(range.start.getTime(), bookable.start.getTime())),
    end: new Date(Math.min(range.end.getTime(), bookable.end.getTime())),
  };
  if (clipped.end <= clipped.start) return { slots: [] as Interval[], errors: [] as string[] };

  // Pad the busy lookup so buffers at the range edges see neighbouring events.
  const pad = Math.max(et.bufferBeforeMin, et.bufferAfterMin) + et.durationMin;
  const lookup: Interval = { start: addMinutes(clipped.start, -pad), end: addMinutes(clipped.end, pad) };
  const [{ busy, errors }, booked] = await Promise.all([
    busyIntervals(et.userId, lookup),
    existingBookings(et.userId, lookup),
  ]);
  const windows = availabilityWindows(et.availability, et.timezone, clipped.start, clipped.end);
  const slots = computeSlots(windows, [...busy, ...booked], {
    durationMin: et.durationMin,
    slotIntervalMin: et.slotIntervalMin,
    bufferBeforeMin: et.bufferBeforeMin,
    bufferAfterMin: et.bufferAfterMin,
    minNoticeMin: et.minNoticeMin,
    now,
  }).filter((s) => s.start >= clipped.start && s.end <= clipped.end);
  return { slots, errors };
}

export type CreateBookingInput = {
  eventType: EventType;
  start: Date;
  name: string;
  email: string;
  notes?: string;
  timezone?: string;
};

export class SlotUnavailableError extends Error {
  constructor() {
    super("That time is no longer available.");
  }
}

export async function createBooking(input: CreateBookingInput) {
  const { eventType: et, start } = input;
  const end = addMinutes(start, et.durationMin);

  // Re-check against live availability right before writing.
  const { slots } = await openSlots(et, { start: addMinutes(start, -1), end: addMinutes(end, 1) });
  if (!slots.some((s) => s.start.getTime() === start.getTime())) throw new SlotUnavailableError();

  const owner = await db.query.user.findFirst({ where: eq(user.id, et.userId) });
  const destination = et.destinationCalendarId
    ? await calendarWithAccount(et.userId, et.destinationCalendarId)
    : null;

  const id = newId();
  let googleEventId: string | null = null;
  let meetUrl: string | null = null;
  if (destination) {
    const res = await insertEvent({
      calendar: destination,
      summary: `${et.title}: ${input.name} & ${owner?.name ?? "host"}`,
      description: [et.description, input.notes && `Notes from ${input.name}:\n${input.notes}`]
        .filter(Boolean)
        .join("\n\n"),
      location: et.location ?? undefined,
      start,
      end,
      attendee: { name: input.name, email: input.email },
      addMeet: et.addMeet,
      requestId: id,
    });
    googleEventId = res.eventId;
    meetUrl = res.meetUrl;
  }

  const [booking] = await db
    .insert(bookings)
    .values({
      id,
      eventTypeId: et.id,
      userId: et.userId,
      startAt: start,
      endAt: end,
      bookerName: input.name,
      bookerEmail: input.email,
      bookerTimezone: input.timezone,
      notes: input.notes,
      googleEventId,
      googleCalendarId: destination?.externalId ?? null,
      meetUrl,
    })
    .returning();
  return booking;
}
