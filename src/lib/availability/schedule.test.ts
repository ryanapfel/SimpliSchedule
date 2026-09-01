import { describe, expect, it } from "vitest";
import type { WeeklyAvailability } from "@/db/schema";
import { availabilityWindows } from "./schedule";

const LA = "America/Los_Angeles";
const iso = (windows: { start: Date; end: Date }[]) =>
  windows.map((w) => [w.start.toISOString(), w.end.toISOString()]);

describe("availabilityWindows", () => {
  it("builds windows for a normal week in America/Los_Angeles", () => {
    const availability: WeeklyAvailability = {
      "1": [
        { start: "09:00", end: "12:00" },
        { start: "13:00", end: "15:00" },
      ],
      "2": [{ start: "10:00", end: "11:00" }],
    };

    const windows = availabilityWindows(
      availability,
      LA,
      new Date("2026-09-07T07:00:00Z"), // Mon Sep 7 2026 00:00 PDT
      new Date("2026-09-09T07:00:00Z"), // Wed Sep 9 2026 00:00 PDT
    );

    expect(iso(windows)).toEqual([
      ["2026-09-07T16:00:00.000Z", "2026-09-07T19:00:00.000Z"],
      ["2026-09-07T20:00:00.000Z", "2026-09-07T22:00:00.000Z"],
      ["2026-09-08T17:00:00.000Z", "2026-09-08T18:00:00.000Z"],
    ]);
  });

  it("produces correct UTC instants across the PDT to PST transition", () => {
    const availability: WeeklyAvailability = {
      "6": [{ start: "09:00", end: "11:00" }],
      "0": [{ start: "09:00", end: "11:00" }],
    };

    const windows = availabilityWindows(
      availability,
      LA,
      new Date("2026-10-31T07:00:00Z"), // Sat Oct 31 2026 00:00 PDT
      new Date("2026-11-02T08:00:00Z"), // Mon Nov 2 2026 00:00 PST
    );

    expect(iso(windows)).toEqual([
      ["2026-10-31T16:00:00.000Z", "2026-10-31T18:00:00.000Z"], // 9am PDT (UTC-7)
      ["2026-11-01T17:00:00.000Z", "2026-11-01T19:00:00.000Z"], // 9am PST (UTC-8)
    ]);
  });

  it("returns windows intersecting the range unclipped, so slots stay aligned to the schedule", () => {
    const availability: WeeklyAvailability = { "1": [{ start: "09:00", end: "12:00" }] };

    const windows = availabilityWindows(
      availability,
      LA,
      new Date("2026-09-07T17:00:00Z"), // 10:00 PDT
      new Date("2026-09-07T18:00:00Z"), // 11:00 PDT
    );

    expect(iso(windows)).toEqual([["2026-09-07T16:00:00.000Z", "2026-09-07T19:00:00.000Z"]]);
  });

  it("drops ranges outside the window and ranges where end <= start", () => {
    const availability: WeeklyAvailability = {
      "1": [
        { start: "09:00", end: "09:00" },
        { start: "14:00", end: "13:00" },
        { start: "09:00", end: "12:00" },
      ],
    };

    const windows = availabilityWindows(
      availability,
      LA,
      new Date("2026-09-07T20:00:00Z"), // 13:00 PDT, after the only real range
      new Date("2026-09-08T07:00:00Z"),
    );

    expect(windows).toEqual([]);
  });
});
