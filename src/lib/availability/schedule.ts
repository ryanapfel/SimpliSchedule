import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import type { WeeklyAvailability } from "@/db/schema";
import type { Interval } from "./types";

type DayKey = keyof WeeklyAvailability;

function nextCalendarDay(day: string): string {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

function weekdayOf(day: string): DayKey {
  return String(new Date(`${day}T12:00:00Z`).getUTCDay()) as DayKey;
}

export function availabilityWindows(
  availability: WeeklyAvailability,
  timezone: string,
  rangeStart: Date,
  rangeEnd: Date,
): Interval[] {
  const windows: Interval[] = [];
  const lastDay = formatInTimeZone(rangeEnd, timezone, "yyyy-MM-dd");

  for (let day = formatInTimeZone(rangeStart, timezone, "yyyy-MM-dd"); day <= lastDay; day = nextCalendarDay(day)) {
    for (const range of availability[weekdayOf(day)] ?? []) {
      const dayStart = fromZonedTime(`${day}T${range.start}:00`, timezone);
      const dayEnd = fromZonedTime(`${day}T${range.end}:00`, timezone);
      if (dayEnd.getTime() <= dayStart.getTime()) continue;

      // Windows are returned unclipped so slot starts stay aligned to the schedule; callers
      // filter slots to their range.
      if (dayStart.getTime() < rangeEnd.getTime() && dayEnd.getTime() > rangeStart.getTime()) {
        windows.push({ start: dayStart, end: dayEnd });
      }
    }
  }

  return windows.sort((a, b) => a.start.getTime() - b.start.getTime());
}
