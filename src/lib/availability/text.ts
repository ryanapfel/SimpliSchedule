import { formatInTimeZone } from "date-fns-tz";
import type { Interval } from "./types";

const DEFAULT_INTRO = "Here's my availability ({tz}) over the next few days:";
const EMPTY_BODY = "I don't have any open slots in that window.";

export function mergeSlots(slots: Interval[]): Interval[] {
  const sorted = [...slots].sort((a, b) => a.start.getTime() - b.start.getTime());
  const merged: Interval[] = [];

  for (const slot of sorted) {
    const last = merged[merged.length - 1];
    if (last && slot.start.getTime() <= last.end.getTime()) {
      if (slot.end.getTime() > last.end.getTime()) last.end = slot.end;
    } else {
      merged.push({ start: slot.start, end: slot.end });
    }
  }

  return merged;
}

type FormatOptions = {
  slots: Interval[];
  timezone: string;
  bookingUrl: string;
  intro?: string;
};

/** Booking page URL that preselects one day and time block, in the text's timezone. */
export function blockUrl(bookingUrl: string, range: Interval, timezone: string): string {
  const q = new URLSearchParams({
    date: formatInTimeZone(range.start, timezone, "yyyy-MM-dd"),
    from: formatInTimeZone(range.start, timezone, "HH:mm"),
    to: formatInTimeZone(range.end, timezone, "HH:mm"),
    tz: timezone,
  });
  return `${bookingUrl}?${q}`;
}

function layout(opts: FormatOptions) {
  const merged = mergeSlots(opts.slots);
  const zone = formatInTimeZone(merged[0]?.start ?? new Date(), opts.timezone, "zzz");
  const intro = (opts.intro ?? DEFAULT_INTRO).replace("{tz}", zone);

  const days = new Map<string, Interval[]>();
  for (const range of merged) {
    const label = formatInTimeZone(range.start, opts.timezone, "EEE, MMM d");
    days.set(label, [...(days.get(label) ?? []), range]);
  }
  return { intro, days };
}

export function formatAvailabilityText(opts: FormatOptions): string {
  const { intro, days } = layout(opts);
  const link = `Or book directly here: ${opts.bookingUrl}`;
  const body =
    days.size === 0
      ? [EMPTY_BODY]
      : [...days].map(([label, ranges]) => `• ${label}: ${ranges.map((r) => rangeLabel(r, opts.timezone)).join(", ")}`);

  return [intro, "", ...body, "", link].join("\n");
}

/** Same content as the text, with each time block linking to the booking page for that block. */
export function formatAvailabilityHtml(opts: FormatOptions): string {
  const { intro, days } = layout(opts);
  const anchor = (href: string, text: string) => `<a href="${escapeHtml(href)}">${escapeHtml(text)}</a>`;
  const body =
    days.size === 0
      ? `<p>${escapeHtml(EMPTY_BODY)}</p>`
      : `<ul>${[...days]
          .map(
            ([label, ranges]) =>
              `<li>${escapeHtml(label)}: ${ranges
                .map((r) => anchor(blockUrl(opts.bookingUrl, r, opts.timezone), rangeLabel(r, opts.timezone)))
                .join(", ")}</li>`,
          )
          .join("")}</ul>`;

  return `<p>${escapeHtml(intro)}</p>${body}<p>Or book directly here: ${anchor(opts.bookingUrl, opts.bookingUrl)}</p>`;
}

function rangeLabel(range: Interval, timezone: string): string {
  return `${time(range.start, timezone)}–${time(range.end, timezone)}`;
}

function time(date: Date, timezone: string): string {
  return formatInTimeZone(date, timezone, "h:mmaaa").toLowerCase();
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
