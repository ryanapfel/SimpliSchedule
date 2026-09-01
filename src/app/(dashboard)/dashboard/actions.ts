"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdmin, requireUser } from "@/auth/session";
import { db } from "@/db";
import {
  apiKeys,
  appSettings,
  bookings,
  calendarAccounts,
  calendars,
  eventTypes,
  user,
} from "@/db/schema";
import { createApiKey } from "@/lib/api-keys";
import { calendarWithAccount, deleteEvent, syncCalendars } from "@/lib/google/calendar";
import { eventTypeSchema, type EventTypeInput } from "@/lib/event-types";
import { newId, newShortCode } from "@/lib/ids";

export type ActionResult<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };

async function ownedEventType(userId: string, id: string) {
  const et = await db.query.eventTypes.findFirst({
    where: and(eq(eventTypes.id, id), eq(eventTypes.userId, userId)),
  });
  if (!et) throw new Error("Booking link not found");
  return et;
}

async function validateDestination(userId: string, calendarId: string | null | undefined) {
  if (!calendarId) return null;
  const cal = await calendarWithAccount(userId, calendarId);
  if (!cal) throw new Error("Destination calendar not found");
  return cal.id;
}

export async function createEventType(input: EventTypeInput): Promise<ActionResult<{ id: string }>> {
  const me = await requireUser();
  const parsed = eventTypeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  try {
    const id = newId();
    await db.insert(eventTypes).values({
      ...parsed.data,
      id,
      userId: me.id,
      shortCode: newShortCode(),
      destinationCalendarId: await validateDestination(me.id, parsed.data.destinationCalendarId),
    });
    revalidatePath("/dashboard", "layout");
    return { ok: true, data: { id } };
  } catch (err) {
    return { ok: false, error: friendly(err) };
  }
}

export async function updateEventType(id: string, input: EventTypeInput): Promise<ActionResult> {
  const me = await requireUser();
  await ownedEventType(me.id, id);
  const parsed = eventTypeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  try {
    await db
      .update(eventTypes)
      .set({
        ...parsed.data,
        destinationCalendarId: await validateDestination(me.id, parsed.data.destinationCalendarId),
        updatedAt: new Date(),
      })
      .where(eq(eventTypes.id, id));
    revalidatePath("/dashboard", "layout");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: friendly(err) };
  }
}

export async function deleteEventType(id: string) {
  const me = await requireUser();
  await ownedEventType(me.id, id);
  await db.delete(eventTypes).where(eq(eventTypes.id, id));
  revalidatePath("/dashboard", "layout");
  redirect("/dashboard/booking-links");
}

export async function cancelBooking(id: string): Promise<ActionResult> {
  const me = await requireUser();
  const b = await db.query.bookings.findFirst({
    where: and(eq(bookings.id, id), eq(bookings.userId, me.id)),
    with: { eventType: true },
  });
  if (!b) return { ok: false, error: "Booking not found" };
  if (b.googleEventId && b.eventType.destinationCalendarId) {
    const cal = await calendarWithAccount(me.id, b.eventType.destinationCalendarId);
    if (cal) {
      try {
        await deleteEvent(cal, b.googleEventId);
      } catch (err) {
        console.error("failed to delete calendar event", err);
      }
    }
  }
  await db.update(bookings).set({ status: "cancelled" }).where(eq(bookings.id, id));
  revalidatePath("/dashboard", "layout");
  return { ok: true };
}

export async function setCalendarConflictCheck(calendarId: string, enabled: boolean): Promise<ActionResult> {
  const me = await requireUser();
  const cal = await calendarWithAccount(me.id, calendarId);
  if (!cal) return { ok: false, error: "Calendar not found" };
  await db.update(calendars).set({ checkForConflicts: enabled }).where(eq(calendars.id, calendarId));
  revalidatePath("/dashboard/calendars");
  return { ok: true };
}

async function ownedAccount(userId: string, accountId: string) {
  return db.query.calendarAccounts.findFirst({
    where: and(eq(calendarAccounts.id, accountId), eq(calendarAccounts.userId, userId)),
  });
}

export async function disconnectAccount(accountId: string): Promise<ActionResult> {
  const me = await requireUser();
  const acct = await ownedAccount(me.id, accountId);
  if (!acct) return { ok: false, error: "Account not found" };
  await db.delete(calendarAccounts).where(eq(calendarAccounts.id, accountId));
  revalidatePath("/dashboard", "layout");
  return { ok: true };
}

export async function resyncAccount(accountId: string): Promise<ActionResult> {
  const me = await requireUser();
  const acct = await ownedAccount(me.id, accountId);
  if (!acct) return { ok: false, error: "Account not found" };
  try {
    await syncCalendars(acct);
  } catch (err) {
    return { ok: false, error: friendly(err) };
  }
  revalidatePath("/dashboard/calendars");
  return { ok: true };
}

const profileSchema = z.object({
  name: z.string().trim().min(1).max(100),
  username: z
    .string()
    .trim()
    .min(2)
    .max(40)
    .regex(/^[a-z0-9-]+$/, "Lowercase letters, numbers and dashes only"),
  timezone: z.string().min(1),
});

export async function updateProfile(input: z.input<typeof profileSchema>): Promise<ActionResult> {
  const me = await requireUser();
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const reserved = new Set(["api", "b", "booking", "dashboard", "login", "signup", "admin"]);
  if (reserved.has(parsed.data.username)) return { ok: false, error: "That username is reserved" };
  try {
    await db.update(user).set(parsed.data).where(eq(user.id, me.id));
  } catch (err) {
    return { ok: false, error: friendly(err) };
  }
  revalidatePath("/dashboard", "layout");
  return { ok: true };
}

export async function createApiKeyAction(name: string): Promise<ActionResult<{ key: string }>> {
  const me = await requireUser();
  const clean = name.trim().slice(0, 100) || "Raycast";
  const key = await createApiKey(me.id, clean);
  revalidatePath("/dashboard/settings");
  return { ok: true, data: { key } };
}

export async function deleteApiKey(id: string): Promise<ActionResult> {
  const me = await requireUser();
  await db.delete(apiKeys).where(and(eq(apiKeys.id, id), eq(apiKeys.userId, me.id)));
  revalidatePath("/dashboard/settings");
  return { ok: true };
}

export async function setSignupsOpen(open: boolean): Promise<ActionResult> {
  await requireAdmin();
  await db
    .insert(appSettings)
    .values({ id: "default", signupsOpen: open })
    .onConflictDoUpdate({ target: appSettings.id, set: { signupsOpen: open, updatedAt: new Date() } });
  revalidatePath("/dashboard/admin");
  return { ok: true };
}

export async function setUserRole(userId: string, role: "admin" | "user"): Promise<ActionResult> {
  const me = await requireAdmin();
  if (userId === me.id) return { ok: false, error: "You can't change your own role" };
  await db.update(user).set({ role }).where(eq(user.id, userId));
  revalidatePath("/dashboard/admin");
  return { ok: true };
}

function friendly(err: unknown) {
  const msg = err instanceof Error ? err.message : String(err);
  if (/event_types_user_slug_uq/.test(msg)) return "You already have an booking link with that slug";
  if (/user_username_unique/.test(msg)) return "That username is taken";
  return msg.length > 200 ? "Something went wrong" : msg;
}
