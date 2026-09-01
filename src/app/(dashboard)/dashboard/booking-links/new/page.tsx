import { requireUser } from "@/auth/session";
import { EventTypeForm, type EventTypeFormValues } from "@/components/dashboard/event-type-form";
import { DEFAULT_AVAILABILITY } from "@/lib/event-types";
import { writableCalendars } from "@/lib/google/calendar";
import { timezoneOptions } from "@/lib/timezones";

export default async function NewEventTypePage() {
  const me = await requireUser();
  const calendars = await writableCalendars(me.id);

  const initial: EventTypeFormValues = {
    title: "",
    slug: "",
    description: null,
    durationMin: 30,
    slotIntervalMin: 30,
    bufferBeforeMin: 0,
    bufferAfterMin: 0,
    minNoticeMin: 120,
    maxDaysAhead: 30,
    timezone: me.timezone ?? "America/Los_Angeles",
    destinationCalendarId: calendars.find((c) => c.isPrimary)?.id ?? null,
    addMeet: true,
    location: null,
    active: true,
    availability: DEFAULT_AVAILABILITY,
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">New booking link</h1>
        <p className="text-sm text-muted-foreground">Set the length, hours and calendar for a new meeting.</p>
      </div>
      <EventTypeForm
        initial={initial}
        calendars={calendars.map((c) => ({ id: c.id, label: `${c.name} — ${c.account.email}` }))}
        timezones={timezoneOptions()}
      />
    </div>
  );
}
