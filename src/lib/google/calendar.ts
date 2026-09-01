import { google, type calendar_v3 } from "googleapis";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { calendarAccounts, calendars, type Calendar, type CalendarAccount } from "@/db/schema";
import { env } from "@/lib/env";
import { newId } from "@/lib/ids";
import type { Interval } from "@/lib/availability/types";
import { clientForAccount } from "./oauth";

function api(account: CalendarAccount) {
  return google.calendar({ version: "v3", auth: clientForAccount(account) });
}

export async function listRemoteCalendars(account: CalendarAccount) {
  const res = await api(account).calendarList.list({ minAccessRole: "reader" });
  return (res.data.items ?? []).filter((c) => c.id);
}

/** Calendars added via URL import or Google's holiday directory rather than owned by the user. */
function isSubscription(externalId: string) {
  return externalId.endsWith("@import.calendar.google.com") || externalId.endsWith("#holiday@group.v.calendar.google.com");
}

/** Pulls the account's calendar list into our `calendars` table (insert new, rename existing). */
export async function syncCalendars(account: CalendarAccount) {
  if (env.CALENDAR_PROVIDER === "none") return;
  const remote = await listRemoteCalendars(account);
  const existing = await db.query.calendars.findMany({
    where: eq(calendars.calendarAccountId, account.id),
  });
  const byExternal = new Map(existing.map((c) => [c.externalId, c]));
  for (const c of remote) {
    const id = c.id!;
    const name = c.summaryOverride ?? c.summary ?? id;
    const prev = byExternal.get(id);
    if (prev) {
      if (prev.name !== name || prev.isPrimary !== Boolean(c.primary)) {
        await db
          .update(calendars)
          .set({ name, isPrimary: Boolean(c.primary) })
          .where(eq(calendars.id, prev.id));
      }
    } else {
      await db.insert(calendars).values({
        id: newId(),
        calendarAccountId: account.id,
        externalId: id,
        name,
        isPrimary: Boolean(c.primary),
        // Only calendars we can write to (owner) are checked by default; shared read-only ones opt in.
        // Subscribed URL/holiday calendars report "owner" too, but their all-day events would block
        // every slot, so they start unchecked.
        checkForConflicts: (c.accessRole === "owner" || c.accessRole === "writer") && !isSubscription(id),
      });
    }
  }
}

/**
 * Busy intervals across every calendar of the user's that is flagged `checkForConflicts`.
 * One free/busy query per connected account. Accounts that fail (revoked token, etc.) are skipped
 * and reported in `errors` so a single broken account doesn't hide the whole schedule.
 */
export async function busyIntervals(
  userId: string,
  range: Interval,
): Promise<{ busy: Interval[]; errors: string[] }> {
  if (env.CALENDAR_PROVIDER === "none") return { busy: [], errors: [] };
  const accounts = await db.query.calendarAccounts.findMany({
    where: eq(calendarAccounts.userId, userId),
    with: { calendars: { where: eq(calendars.checkForConflicts, true) } },
  });
  const busy: Interval[] = [];
  const errors: string[] = [];
  await Promise.all(
    accounts
      .filter((a) => a.calendars.length > 0)
      .map(async (account) => {
        try {
          const res = await api(account).freebusy.query({
            requestBody: {
              timeMin: range.start.toISOString(),
              timeMax: range.end.toISOString(),
              items: account.calendars.map((c) => ({ id: c.externalId })),
            },
          });
          for (const cal of Object.values(res.data.calendars ?? {})) {
            for (const b of cal.busy ?? []) {
              if (b.start && b.end) busy.push({ start: new Date(b.start), end: new Date(b.end) });
            }
          }
        } catch (err) {
          errors.push(`${account.email}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }),
  );
  return { busy, errors };
}

export type InsertEventInput = {
  calendar: Calendar & { account: CalendarAccount };
  summary: string;
  description?: string;
  location?: string;
  start: Date;
  end: Date;
  attendee: { name: string; email: string };
  addMeet: boolean;
  requestId: string;
};

export async function insertEvent(input: InsertEventInput) {
  if (env.CALENDAR_PROVIDER === "none") return { eventId: null, meetUrl: null, htmlLink: null };
  const requestBody: calendar_v3.Schema$Event = {
    summary: input.summary,
    description: input.description,
    location: input.location,
    start: { dateTime: input.start.toISOString() },
    end: { dateTime: input.end.toISOString() },
    attendees: [{ email: input.attendee.email, displayName: input.attendee.name }],
    reminders: { useDefault: true },
  };
  if (input.addMeet) {
    requestBody.conferenceData = {
      createRequest: { requestId: input.requestId, conferenceSolutionKey: { type: "hangoutsMeet" } },
    };
  }
  const res = await api(input.calendar.account).events.insert({
    calendarId: input.calendar.externalId,
    conferenceDataVersion: input.addMeet ? 1 : 0,
    sendUpdates: "all",
    requestBody,
  });
  return {
    eventId: res.data.id ?? null,
    meetUrl: res.data.hangoutLink ?? null,
    htmlLink: res.data.htmlLink ?? null,
  };
}

export async function deleteEvent(calendar: Calendar & { account: CalendarAccount }, eventId: string) {
  if (env.CALENDAR_PROVIDER === "none") return;
  await api(calendar.account).events.delete({
    calendarId: calendar.externalId,
    eventId,
    sendUpdates: "all",
  });
}

/** The calendars a user can pick as a booking destination, with their account attached. */
export async function writableCalendars(userId: string) {
  const accounts = await db.query.calendarAccounts.findMany({
    where: eq(calendarAccounts.userId, userId),
    with: { calendars: true },
  });
  return accounts.flatMap((a) => a.calendars.map((c) => ({ ...c, account: a })));
}

export async function calendarWithAccount(userId: string, calendarId: string) {
  const row = await db.query.calendars.findFirst({
    where: eq(calendars.id, calendarId),
    with: { account: true },
  });
  if (!row || row.account.userId !== userId) return null;
  return row;
}

