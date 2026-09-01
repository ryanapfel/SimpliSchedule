import { z } from "zod";
import type { WeeklyAvailability } from "@/db/schema";
import { slugify } from "@/lib/ids";

const timeRange = z.object({
  start: z.string().regex(/^\d{2}:\d{2}$/),
  end: z.string().regex(/^\d{2}:\d{2}$/),
});

export const eventTypeSchema = z.object({
  title: z.string().trim().min(1).max(100),
  slug: z.string().trim().min(1).max(60).transform(slugify),
  description: z.string().trim().max(2000).optional().nullable(),
  durationMin: z.coerce.number().int().min(5).max(24 * 60),
  slotIntervalMin: z.coerce.number().int().min(5).max(24 * 60),
  bufferBeforeMin: z.coerce.number().int().min(0).max(24 * 60),
  bufferAfterMin: z.coerce.number().int().min(0).max(24 * 60),
  minNoticeMin: z.coerce.number().int().min(0).max(30 * 24 * 60),
  maxDaysAhead: z.coerce.number().int().min(1).max(365),
  timezone: z.string().min(1),
  availability: z.partialRecord(z.enum(["0", "1", "2", "3", "4", "5", "6"]), z.array(timeRange)),
  destinationCalendarId: z.string().optional().nullable(),
  addMeet: z.boolean(),
  location: z.string().trim().max(500).optional().nullable(),
  active: z.boolean(),
});
export type EventTypeInput = z.input<typeof eventTypeSchema>;

export const DEFAULT_AVAILABILITY: WeeklyAvailability = {
  "1": [{ start: "09:00", end: "17:00" }],
  "2": [{ start: "09:00", end: "17:00" }],
  "3": [{ start: "09:00", end: "17:00" }],
  "4": [{ start: "09:00", end: "17:00" }],
  "5": [{ start: "09:00", end: "17:00" }],
};
