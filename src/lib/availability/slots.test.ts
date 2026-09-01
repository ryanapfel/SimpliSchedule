import { describe, expect, it } from "vitest";
import { computeSlots, overlaps, type SlotOptions } from "./slots";
import type { Interval } from "./types";

const at = (iso: string) => new Date(iso);
const range = (start: string, end: string): Interval => ({ start: at(start), end: at(end) });
const startsOf = (slots: Interval[]) => slots.map((s) => s.start.toISOString());

const opts = (over: Partial<SlotOptions> = {}): SlotOptions => ({
  durationMin: 30,
  slotIntervalMin: 30,
  bufferBeforeMin: 0,
  bufferAfterMin: 0,
  minNoticeMin: 0,
  now: at("2026-01-01T00:00:00Z"),
  ...over,
});

describe("overlaps", () => {
  it("treats intervals as half-open, so touching does not overlap", () => {
    expect(overlaps(range("2026-09-07T16:00:00Z", "2026-09-07T17:00:00Z"), range("2026-09-07T17:00:00Z", "2026-09-07T18:00:00Z"))).toBe(false);
    expect(overlaps(range("2026-09-07T17:00:00Z", "2026-09-07T18:00:00Z"), range("2026-09-07T16:00:00Z", "2026-09-07T17:00:00Z"))).toBe(false);
  });

  it("detects real overlap in both directions", () => {
    expect(overlaps(range("2026-09-07T16:00:00Z", "2026-09-07T17:00:00Z"), range("2026-09-07T16:30:00Z", "2026-09-07T18:00:00Z"))).toBe(true);
    expect(overlaps(range("2026-09-07T16:30:00Z", "2026-09-07T18:00:00Z"), range("2026-09-07T16:00:00Z", "2026-09-07T17:00:00Z"))).toBe(true);
  });
});

describe("computeSlots", () => {
  it("steps by the slot interval while the duration still fits", () => {
    const windows = [range("2026-09-07T16:00:00Z", "2026-09-07T19:00:00Z")];

    expect(startsOf(computeSlots(windows, [], opts()))).toEqual([
      "2026-09-07T16:00:00.000Z",
      "2026-09-07T16:30:00.000Z",
      "2026-09-07T17:00:00.000Z",
      "2026-09-07T17:30:00.000Z",
      "2026-09-07T18:00:00.000Z",
      "2026-09-07T18:30:00.000Z",
    ]);

    expect(startsOf(computeSlots(windows, [], opts({ durationMin: 45 })))).toEqual([
      "2026-09-07T16:00:00.000Z",
      "2026-09-07T16:30:00.000Z",
      "2026-09-07T17:00:00.000Z",
      "2026-09-07T17:30:00.000Z",
      "2026-09-07T18:00:00.000Z",
    ]);
  });

  it("drops candidates whose busy overlap only appears with buffers", () => {
    const windows = [range("2026-09-07T16:00:00Z", "2026-09-07T18:00:00Z")];
    const busy = [range("2026-09-07T17:00:00Z", "2026-09-07T17:30:00Z")];

    expect(startsOf(computeSlots(windows, busy, opts()))).toEqual([
      "2026-09-07T16:00:00.000Z",
      "2026-09-07T16:30:00.000Z",
      "2026-09-07T17:30:00.000Z",
    ]);

    expect(
      startsOf(computeSlots(windows, busy, opts({ bufferBeforeMin: 15, bufferAfterMin: 15 }))),
    ).toEqual(["2026-09-07T16:00:00.000Z"]);
  });

  it("honors minimum notice", () => {
    const windows = [range("2026-09-07T16:00:00Z", "2026-09-07T18:00:00Z")];

    const slots = computeSlots(
      windows,
      [],
      opts({ now: at("2026-09-07T16:00:00Z"), minNoticeMin: 60 }),
    );

    expect(startsOf(slots)).toEqual(["2026-09-07T17:00:00.000Z", "2026-09-07T17:30:00.000Z"]);
  });

  it("deduplicates and sorts starts across overlapping windows", () => {
    const windows = [
      range("2026-09-07T16:30:00Z", "2026-09-07T17:30:00Z"),
      range("2026-09-07T16:00:00Z", "2026-09-07T17:00:00Z"),
    ];

    const slots = computeSlots(windows, [], opts());

    expect(startsOf(slots)).toEqual([
      "2026-09-07T16:00:00.000Z",
      "2026-09-07T16:30:00.000Z",
      "2026-09-07T17:00:00.000Z",
    ]);
    expect(slots.map((s) => s.end.toISOString())).toEqual([
      "2026-09-07T16:30:00.000Z",
      "2026-09-07T17:00:00.000Z",
      "2026-09-07T17:30:00.000Z",
    ]);
  });

  it("returns nothing when the duration does not fit the window", () => {
    const windows = [range("2026-09-07T16:00:00Z", "2026-09-07T16:20:00Z")];
    expect(computeSlots(windows, [], opts())).toEqual([]);
  });
});
