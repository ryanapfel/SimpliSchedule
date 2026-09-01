"use client";

import { PlusIcon, XIcon } from "lucide-react";
import type { TimeRange, WeeklyAvailability } from "@/db/schema";
import { WEEKDAYS } from "@/lib/timezones";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

export const DAY_KEYS = ["0", "1", "2", "3", "4", "5", "6"] as const;
export type DayKey = (typeof DAY_KEYS)[number];
export type DayRow = { enabled: boolean; ranges: TimeRange[] };
export type DayRows = Record<DayKey, DayRow>;

const DEFAULT_RANGE: TimeRange = { start: "09:00", end: "17:00" };

export function rowsFromAvailability(availability: WeeklyAvailability): DayRows {
  return Object.fromEntries(
    DAY_KEYS.map((key) => {
      const ranges = availability[key] ?? [];
      return [key, { enabled: ranges.length > 0, ranges: ranges.length > 0 ? ranges : [DEFAULT_RANGE] }];
    }),
  ) as DayRows;
}

/** Disabled days become empty arrays so every weekday key is present for the action's schema. */
export function availabilityFromRows(rows: DayRows): Record<DayKey, TimeRange[]> {
  return Object.fromEntries(
    DAY_KEYS.map((key) => [key, rows[key].enabled ? rows[key].ranges : []]),
  ) as Record<DayKey, TimeRange[]>;
}

export function AvailabilityEditor({
  value,
  onChange,
}: {
  value: DayRows;
  onChange: (rows: DayRows) => void;
}) {
  function update(key: DayKey, row: Partial<DayRow>) {
    onChange({ ...value, [key]: { ...value[key], ...row } });
  }

  function setRange(key: DayKey, index: number, range: Partial<TimeRange>) {
    update(key, {
      ranges: value[key].ranges.map((r, i) => (i === index ? { ...r, ...range } : r)),
    });
  }

  return (
    <div className="divide-y rounded-lg border">
      {DAY_KEYS.map((key) => {
        const row = value[key];
        return (
          <div key={key} className="flex flex-wrap items-start gap-3 p-3">
            <div className="flex w-32 shrink-0 items-center gap-2 pt-1.5">
              <Checkbox
                id={`day-${key}`}
                checked={row.enabled}
                onCheckedChange={(checked) => update(key, { enabled: checked === true })}
              />
              <Label htmlFor={`day-${key}`} className="font-normal">
                {WEEKDAYS[Number(key)]}
              </Label>
            </div>
            {row.enabled ? (
              <div className="space-y-2">
                {row.ranges.map((range, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <input
                      type="time"
                      aria-label={`${WEEKDAYS[Number(key)]} start`}
                      value={range.start}
                      onChange={(e) => setRange(key, index, { start: e.target.value })}
                      className="h-8 rounded-lg border bg-background px-2 text-sm"
                    />
                    <span className="text-muted-foreground">–</span>
                    <input
                      type="time"
                      aria-label={`${WEEKDAYS[Number(key)]} end`}
                      value={range.end}
                      onChange={(e) => setRange(key, index, { end: e.target.value })}
                      className="h-8 rounded-lg border bg-background px-2 text-sm"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Remove range"
                      disabled={row.ranges.length === 1}
                      onClick={() => update(key, { ranges: row.ranges.filter((_, i) => i !== index) })}
                    >
                      <XIcon />
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => update(key, { ranges: [...row.ranges, DEFAULT_RANGE] })}
                >
                  <PlusIcon />
                  Add range
                </Button>
              </div>
            ) : (
              <span className="pt-1.5 text-sm text-muted-foreground">Unavailable</span>
            )}
          </div>
        );
      })}
    </div>
  );
}
