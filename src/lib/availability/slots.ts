import type { Interval } from "./types";

export type SlotOptions = {
  durationMin: number;
  slotIntervalMin: number;
  bufferBeforeMin: number;
  bufferAfterMin: number;
  minNoticeMin: number;
  now: Date;
};

const MINUTE = 60_000;

export function overlaps(a: Interval, b: Interval): boolean {
  return a.start.getTime() < b.end.getTime() && b.start.getTime() < a.end.getTime();
}

export function computeSlots(windows: Interval[], busy: Interval[], opts: SlotOptions): Interval[] {
  const step = opts.slotIntervalMin * MINUTE;
  if (step <= 0) return [];

  const duration = opts.durationMin * MINUTE;
  const before = opts.bufferBeforeMin * MINUTE;
  const after = opts.bufferAfterMin * MINUTE;
  const earliest = opts.now.getTime() + opts.minNoticeMin * MINUTE;

  const starts = new Set<number>();
  for (const window of windows) {
    const limit = window.end.getTime() - duration;
    for (let t = window.start.getTime(); t <= limit; t += step) {
      if (t < earliest || starts.has(t)) continue;
      const padded = { start: new Date(t - before), end: new Date(t + duration + after) };
      if (busy.some((b) => overlaps(padded, b))) continue;
      starts.add(t);
    }
  }

  return [...starts]
    .sort((a, b) => a - b)
    .map((t) => ({ start: new Date(t), end: new Date(t + duration) }));
}
