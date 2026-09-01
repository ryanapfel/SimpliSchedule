"use client";

import { addDays, addMinutes, format } from "date-fns";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { Clock, Globe, MapPin, Video } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { timezoneOptions } from "@/lib/timezones";

/** Day and optional time block to open on, from ?date/from/to/tz in the URL. */
export type Preselect = { date: string; from: string | null; to: string | null; tz: string | null };

export type BookingPageProps = {
  username: string;
  slug: string;
  hostName: string;
  title: string;
  description: string | null;
  durationMin: number;
  maxDaysAhead: number;
  location: string | null;
  addMeet: boolean;
  preselect?: Preselect | null;
};

const noSubscribe = () => () => {};
const browserTimezone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
const dayKey = (d: Date) => format(d, "yyyy-MM-dd");

export function BookingPage(props: BookingPageProps) {
  const router = useRouter();
  const browserTz = useSyncExternalStore(noSubscribe, browserTimezone, () => "UTC");
  const [tzOverride, setTz] = useState<string | null>(props.preselect?.tz ?? null);
  const tz = tzOverride ?? browserTz;
  const [slots, setSlots] = useState<Date[] | null>(null);
  const [selectedDay, setSelectedDay] = useState<string | null>(props.preselect?.date ?? null);
  const [showAll, setShowAll] = useState(false);
  const [picked, setPicked] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    const start = new Date();
    const q = new URLSearchParams({
      username: props.username,
      slug: props.slug,
      start: start.toISOString(),
      end: addDays(start, props.maxDaysAhead).toISOString(),
    });
    fetch(`/api/slots?${q}`)
      .then((r) => r.json())
      .then((d: { slots?: string[] }) => setSlots((d.slots ?? []).map((s) => new Date(s))))
      .catch(() => setError("Couldn't load availability."));
  }, [props.username, props.slug, props.maxDaysAhead]);

  // Slots grouped by calendar day in the viewer's timezone. Keys match dayKey() of the picker's dates.
  const byDay = useMemo(() => {
    const map = new Map<string, Date[]>();
    for (const s of slots ?? []) {
      const key = formatInTimeZone(s, tz, "yyyy-MM-dd");
      map.set(key, [...(map.get(key) ?? []), s]);
    }
    return map;
  }, [slots, tz]);

  const firstDay = [...byDay.keys()].sort()[0] ?? null;
  const activeDay = selectedDay && byDay.has(selectedDay) ? selectedDay : firstDay;
  const allDaySlots = activeDay ? byDay.get(activeDay)! : [];

  // A linked time block ("9:00am–11:30am") narrows the day's slots until the viewer asks for all.
  const block = useMemo(() => {
    const p = props.preselect;
    if (!p?.from || !p.to || showAll || activeDay !== p.date) return null;
    const zone = p.tz ?? tz;
    return { start: fromZonedTime(`${p.date}T${p.from}:00`, zone), end: fromZonedTime(`${p.date}T${p.to}:00`, zone) };
  }, [props.preselect, showAll, activeDay, tz]);
  const blockSlots = block ? allDaySlots.filter((s) => s >= block.start && s < block.end) : [];
  const daySlots = blockSlots.length > 0 ? blockSlots : allDaySlots;
  const today = new Date();

  async function book(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!picked) return;
    setPending(true);
    setError(null);
    const form = new FormData(e.currentTarget);
    const res = await fetch("/api/book", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        username: props.username,
        slug: props.slug,
        start: picked.toISOString(),
        name: form.get("name"),
        email: form.get("email"),
        notes: form.get("notes") || undefined,
        timezone: tz,
      }),
    });
    const data = (await res.json()) as { id?: string; error?: string };
    setPending(false);
    if (!res.ok || !data.id) {
      setError(data.error ?? "Booking failed.");
      if (res.status === 409) setPicked(null);
      return;
    }
    router.push(`/booking/${data.id}`);
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col rounded-xl border bg-background shadow-sm md:flex-row">
      {/* Event details */}
      <aside className="space-y-4 border-b p-6 md:w-72 md:shrink-0 md:border-r md:border-b-0">
        <div>
          <p className="text-sm text-muted-foreground">{props.hostName}</p>
          <h1 className="text-2xl font-semibold tracking-tight">{props.title}</h1>
        </div>
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li className="flex items-center gap-2">
            <Clock className="size-4" /> {props.durationMin} min
          </li>
          {props.addMeet && (
            <li className="flex items-center gap-2">
              <Video className="size-4" /> Google Meet
            </li>
          )}
          {props.location && (
            <li className="flex items-center gap-2">
              <MapPin className="size-4" /> {props.location}
            </li>
          )}
          <li className="flex items-center gap-2">
            <Globe className="size-4" />
            <Select value={tz} onValueChange={setTz}>
              <SelectTrigger aria-label="Timezone" size="sm" className="h-7 border-0 px-1 shadow-none">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {timezoneOptions().map((z) => (
                  <SelectItem key={z} value={z}>
                    {z}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </li>
        </ul>
        {props.description && <p className="whitespace-pre-line text-sm">{props.description}</p>}
      </aside>

      {picked ? (
        <form onSubmit={book} className="flex-1 space-y-4 p-6">
          <div>
            <p className="font-medium">{formatInTimeZone(picked, tz, "EEEE, MMMM d")}</p>
            <p className="text-sm text-muted-foreground">
              {formatInTimeZone(picked, tz, "h:mmaaa")} – {formatInTimeZone(addMinutes(picked, props.durationMin), tz, "h:mmaaa")} ({formatInTimeZone(picked, tz, "zzz")})
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="name">Your name</Label>
            <Input id="name" name="name" required autoComplete="name" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" required autoComplete="email" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes">Anything to share ahead of time?</Label>
            <Textarea id="notes" name="notes" rows={3} />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => setPicked(null)}>
              Back
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Booking…" : "Confirm booking"}
            </Button>
          </div>
        </form>
      ) : (
        <>
          {/* Month calendar */}
          <div className="flex flex-1 items-start justify-center p-6">
            <Calendar
              mode="single"
              selected={activeDay ? new Date(`${activeDay}T12:00:00`) : undefined}
              onSelect={(d) => d && setSelectedDay(dayKey(d))}
              startMonth={today}
              endMonth={addDays(today, props.maxDaysAhead)}
              disabled={(d) => !byDay.has(dayKey(d))}
              modifiers={{ available: (d) => byDay.has(dayKey(d)) }}
              modifiersClassNames={{ available: "[&>button]:font-semibold [&>button]:bg-muted" }}
              showOutsideDays={false}
              className="p-0"
            />
          </div>

          {/* Slots for the selected day */}
          <div className="border-t p-6 md:w-56 md:shrink-0 md:border-t-0 md:border-l">
            {slots === null ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : activeDay ? (
              <>
                <p className="mb-3 text-sm font-medium">
                  {formatInTimeZone(daySlots[0], tz, "EEEE, MMM d")}
                </p>
                {block && blockSlots.length > 0 && (
                  <p className="mb-3 text-xs text-muted-foreground">
                    {formatInTimeZone(block.start, tz, "h:mmaaa")}–{formatInTimeZone(block.end, tz, "h:mmaaa")} ·{" "}
                    <button type="button" className="underline" onClick={() => setShowAll(true)}>
                      Show all times
                    </button>
                  </p>
                )}
                <div className="grid max-h-[340px] grid-cols-3 content-start gap-2 overflow-y-auto pr-1 md:grid-cols-1">
                  {daySlots.map((s) => (
                    <Button key={s.toISOString()} variant="outline" onClick={() => setPicked(s)}>
                      {formatInTimeZone(s, tz, "h:mmaaa")}
                    </Button>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">No open times in the next {props.maxDaysAhead} days.</p>
            )}
            {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
          </div>
        </>
      )}
    </div>
  );
}
