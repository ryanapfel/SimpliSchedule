import { afterEach, describe, expect, it, vi } from "vitest";
import { blockUrl, formatAvailabilityHtml, formatAvailabilityText, mergeSlots } from "./text";
import type { Interval } from "./types";

const range = (start: string, end: string): Interval => ({
  start: new Date(start),
  end: new Date(end),
});

const iso = (slots: Interval[]) => slots.map((s) => [s.start.toISOString(), s.end.toISOString()]);

const bookingUrl = "https://host/b/k3j9x";

// Mon Sep 7 2026: 9:00-10:00 + 10:00-11:30 PDT (touching), then 13:00-15:00 PDT.
// Tue Sep 8 2026: 10:00-12:00 PDT.
const fixture = [
  range("2026-09-07T16:00:00Z", "2026-09-07T17:00:00Z"),
  range("2026-09-07T17:00:00Z", "2026-09-07T18:30:00Z"),
  range("2026-09-07T20:00:00Z", "2026-09-07T22:00:00Z"),
  range("2026-09-08T17:00:00Z", "2026-09-08T19:00:00Z"),
];

describe("mergeSlots", () => {
  it("merges touching and overlapping ranges from unsorted input", () => {
    const merged = mergeSlots([
      range("2026-09-07T17:00:00Z", "2026-09-07T18:00:00Z"),
      range("2026-09-07T16:00:00Z", "2026-09-07T17:00:00Z"), // touching
      range("2026-09-07T19:00:00Z", "2026-09-07T20:00:00Z"),
      range("2026-09-07T17:30:00Z", "2026-09-07T18:15:00Z"), // overlapping
      range("2026-09-07T21:00:00Z", "2026-09-07T22:00:00Z"),
    ]);

    expect(iso(merged)).toEqual([
      ["2026-09-07T16:00:00.000Z", "2026-09-07T18:15:00.000Z"],
      ["2026-09-07T19:00:00.000Z", "2026-09-07T20:00:00.000Z"],
      ["2026-09-07T21:00:00.000Z", "2026-09-07T22:00:00.000Z"],
    ]);
  });

  it("does not merge a fully contained range into a longer one incorrectly", () => {
    const merged = mergeSlots([
      range("2026-09-07T16:00:00Z", "2026-09-07T19:00:00Z"),
      range("2026-09-07T17:00:00Z", "2026-09-07T18:00:00Z"),
    ]);

    expect(iso(merged)).toEqual([["2026-09-07T16:00:00.000Z", "2026-09-07T19:00:00.000Z"]]);
  });

  it("returns an empty list unchanged and does not mutate its input", () => {
    const slots = [range("2026-09-07T16:00:00Z", "2026-09-07T17:00:00Z")];
    mergeSlots([...slots, range("2026-09-07T17:00:00Z", "2026-09-07T18:00:00Z")]);

    expect(mergeSlots([])).toEqual([]);
    expect(slots[0]!.end.toISOString()).toBe("2026-09-07T17:00:00.000Z");
  });
});

describe("formatAvailabilityText", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders merged slots grouped by day in America/Los_Angeles", () => {
    const text = formatAvailabilityText({
      slots: fixture,
      timezone: "America/Los_Angeles",
      bookingUrl,
    });

    expect(text).toBe(
      [
        "Here's my availability (PDT) over the next few days:",
        "",
        "• Mon, Sep 7: 9:00am–11:30am, 1:00pm–3:00pm",
        "• Tue, Sep 8: 10:00am–12:00pm",
        "",
        "Or book directly here: https://host/b/k3j9x",
      ].join("\n"),
    );
  });

  it("renders the same instants in America/New_York", () => {
    const text = formatAvailabilityText({
      slots: fixture,
      timezone: "America/New_York",
      bookingUrl,
    });

    expect(text).toBe(
      [
        "Here's my availability (EDT) over the next few days:",
        "",
        "• Mon, Sep 7: 12:00pm–2:30pm, 4:00pm–6:00pm",
        "• Tue, Sep 8: 1:00pm–3:00pm",
        "",
        "Or book directly here: https://host/b/k3j9x",
      ].join("\n"),
    );
  });

  it("uses the current zone abbreviation and a placeholder body when there are no slots", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-07T16:00:00Z"));

    const text = formatAvailabilityText({
      slots: [],
      timezone: "America/Los_Angeles",
      bookingUrl,
    });

    expect(text).toBe(
      [
        "Here's my availability (PDT) over the next few days:",
        "",
        "I don't have any open slots in that window.",
        "",
        "Or book directly here: https://host/b/k3j9x",
      ].join("\n"),
    );
  });

  it("substitutes the zone into a custom intro", () => {
    const text = formatAvailabilityText({
      slots: fixture,
      timezone: "America/Los_Angeles",
      bookingUrl,
      intro: "Times below are {tz}:",
    });

    expect(text.split("\n")[0]).toBe("Times below are PDT:");
  });
});

describe("blockUrl", () => {
  it("encodes the block's day and times in the given timezone", () => {
    expect(blockUrl(bookingUrl, fixture[0]!, "America/Los_Angeles")).toBe(
      "https://host/b/k3j9x?date=2026-09-07&from=09%3A00&to=10%3A00&tz=America%2FLos_Angeles",
    );
  });
});

describe("formatAvailabilityHtml", () => {
  it("links each merged block to the booking page for that block", () => {
    const html = formatAvailabilityHtml({ slots: fixture, timezone: "America/Los_Angeles", bookingUrl });

    expect(html).toBe(
      "<p>Here&apos;s my availability (PDT) over the next few days:</p>".replace("&apos;", "'") +
        "<ul>" +
        '<li>Mon, Sep 7: <a href="https://host/b/k3j9x?date=2026-09-07&amp;from=09%3A00&amp;to=11%3A30&amp;tz=America%2FLos_Angeles">9:00am–11:30am</a>, ' +
        '<a href="https://host/b/k3j9x?date=2026-09-07&amp;from=13%3A00&amp;to=15%3A00&amp;tz=America%2FLos_Angeles">1:00pm–3:00pm</a></li>' +
        '<li>Tue, Sep 8: <a href="https://host/b/k3j9x?date=2026-09-08&amp;from=10%3A00&amp;to=12%3A00&amp;tz=America%2FLos_Angeles">10:00am–12:00pm</a></li>' +
        "</ul>" +
        '<p>Or book directly here: <a href="https://host/b/k3j9x">https://host/b/k3j9x</a></p>',
    );
  });

  it("escapes markup in the intro and falls back to the empty body", () => {
    const html = formatAvailabilityHtml({ slots: [], timezone: "UTC", bookingUrl, intro: "<b>{tz}</b>" });
    expect(html).toContain("<p>&lt;b&gt;UTC&lt;/b&gt;</p><p>I don't have any open slots in that window.</p>");
  });
});
