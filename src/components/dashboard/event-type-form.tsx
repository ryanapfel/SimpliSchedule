"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { createEventType, updateEventType } from "@/app/(dashboard)/dashboard/actions";
import type { EventTypeInput } from "@/lib/event-types";
import {
  AvailabilityEditor,
  availabilityFromRows,
  rowsFromAvailability,
  type DayRows,
} from "@/components/dashboard/availability-editor";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { WeeklyAvailability } from "@/db/schema";
import { slugify } from "@/lib/ids";

export type CalendarOption = { id: string; label: string };

export type EventTypeFormValues = {
  title: string;
  slug: string;
  description: string | null;
  durationMin: number;
  slotIntervalMin: number;
  bufferBeforeMin: number;
  bufferAfterMin: number;
  minNoticeMin: number;
  maxDaysAhead: number;
  timezone: string;
  destinationCalendarId: string | null;
  addMeet: boolean;
  location: string | null;
  active: boolean;
  availability: WeeklyAvailability;
};

const NO_CALENDAR = "none";

export function EventTypeForm({
  eventTypeId,
  initial,
  calendars,
  timezones,
}: {
  /** Present when editing; omitted when creating. */
  eventTypeId?: string;
  initial: EventTypeFormValues;
  calendars: CalendarOption[];
  timezones: string[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [rows, setRows] = useState<DayRows>(() => rowsFromAvailability(initial.availability));
  const [slugTouched, setSlugTouched] = useState(Boolean(eventTypeId));
  const [form, setForm] = useState({
    title: initial.title,
    slug: initial.slug,
    description: initial.description ?? "",
    durationMin: String(initial.durationMin),
    slotIntervalMin: String(initial.slotIntervalMin),
    bufferBeforeMin: String(initial.bufferBeforeMin),
    bufferAfterMin: String(initial.bufferAfterMin),
    minNoticeMin: String(initial.minNoticeMin),
    maxDaysAhead: String(initial.maxDaysAhead),
    timezone: initial.timezone,
    destinationCalendarId: initial.destinationCalendarId ?? NO_CALENDAR,
    addMeet: initial.addMeet,
    location: initial.location ?? "",
    active: initial.active,
  });

  type Field = keyof typeof form;
  function set<K extends Field>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function onTitleChange(title: string) {
    setForm((prev) => ({ ...prev, title, slug: slugTouched ? prev.slug : slugify(title) }));
  }

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const input: EventTypeInput = {
      title: form.title,
      slug: form.slug || slugify(form.title),
      description: form.description.trim() || null,
      durationMin: form.durationMin,
      slotIntervalMin: form.slotIntervalMin,
      bufferBeforeMin: form.bufferBeforeMin,
      bufferAfterMin: form.bufferAfterMin,
      minNoticeMin: form.minNoticeMin,
      maxDaysAhead: form.maxDaysAhead,
      timezone: form.timezone,
      availability: availabilityFromRows(rows),
      destinationCalendarId:
        form.destinationCalendarId === NO_CALENDAR ? null : form.destinationCalendarId,
      addMeet: form.addMeet,
      location: form.location.trim() || null,
      active: form.active,
    };

    startTransition(async () => {
      if (eventTypeId) {
        const res = await updateEventType(eventTypeId, input);
        if (!res.ok) {
          toast.error(res.error);
          return;
        }
        toast.success("Saved");
        router.refresh();
        return;
      }
      const res = await createEventType(input);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      if (res.data) router.push(`/dashboard/booking-links/${res.data.id}`);
    });
  }

  type NumberField =
    | "durationMin"
    | "slotIntervalMin"
    | "bufferBeforeMin"
    | "bufferAfterMin"
    | "minNoticeMin"
    | "maxDaysAhead";

  const numberField = (key: NumberField, label: string, hint?: string) => (
    <div className="space-y-2">
      <Label htmlFor={key}>{label}</Label>
      <Input
        id={key}
        type="number"
        min={0}
        inputMode="numeric"
        value={form[key]}
        onChange={(e) => set(key, e.target.value)}
      />
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                required
                value={form.title}
                onChange={(e) => onTitleChange(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="slug">Slug</Label>
              <Input
                id="slug"
                required
                value={form.slug}
                onChange={(e) => {
                  setSlugTouched(true);
                  set("slug", e.target.value);
                }}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              rows={3}
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="location">Location</Label>
            <Input
              id="location"
              placeholder="Google Meet, phone, an address…"
              value={form.location}
              onChange={(e) => set("location", e.target.value)}
            />
          </div>
          <div className="flex items-center gap-3">
            <Switch id="active" checked={form.active} onCheckedChange={(v) => set("active", v)} />
            <Label htmlFor="active" className="font-normal">
              Active — bookable at its public links
            </Label>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Scheduling</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {numberField("durationMin", "Duration (min)")}
          {numberField("slotIntervalMin", "Slot interval (min)", "How far apart offered start times are.")}
          {numberField("bufferBeforeMin", "Buffer before (min)")}
          {numberField("bufferAfterMin", "Buffer after (min)")}
          {numberField("minNoticeMin", "Minimum notice (min)")}
          {numberField("maxDaysAhead", "Max days ahead")}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Availability</CardTitle>
          <CardDescription>Weekly hours, in the booking link&apos;s timezone.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2 sm:max-w-sm">
            <Label htmlFor="timezone">Timezone</Label>
            <Select value={form.timezone} onValueChange={(v) => set("timezone", v)}>
              <SelectTrigger id="timezone" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {timezones.map((tz) => (
                  <SelectItem key={tz} value={tz}>
                    {tz}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <AvailabilityEditor value={rows} onChange={setRows} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Calendar</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2 sm:max-w-sm">
            <Label htmlFor="destination">Destination calendar</Label>
            <Select
              value={form.destinationCalendarId}
              onValueChange={(v) => set("destinationCalendarId", v)}
            >
              <SelectTrigger id="destination" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_CALENDAR}>None (don&apos;t create calendar events)</SelectItem>
                {calendars.map((cal) => (
                  <SelectItem key={cal.id} value={cal.id}>
                    {cal.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-3">
            <Switch id="addMeet" checked={form.addMeet} onCheckedChange={(v) => set("addMeet", v)} />
            <Label htmlFor="addMeet" className="font-normal">
              Add a Google Meet link
            </Label>
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : eventTypeId ? "Save changes" : "Create booking link"}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.push("/dashboard/booking-links")}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
