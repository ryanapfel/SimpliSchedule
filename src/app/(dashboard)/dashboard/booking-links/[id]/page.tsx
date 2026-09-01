import { and, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { requireUser } from "@/auth/session";
import { CopyButton } from "@/components/dashboard/copy-button";
import { DeleteEventTypeButton } from "@/components/dashboard/delete-event-type-button";
import { EventTypeForm } from "@/components/dashboard/event-type-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { db } from "@/db";
import { eventTypes } from "@/db/schema";
import { env } from "@/lib/env";
import { writableCalendars } from "@/lib/google/calendar";
import { timezoneOptions } from "@/lib/timezones";

export default async function EditEventTypePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await requireUser();
  const eventType = await db.query.eventTypes.findFirst({
    where: and(eq(eventTypes.id, id), eq(eventTypes.userId, me.id)),
  });
  if (!eventType) notFound();

  const calendars = await writableCalendars(me.id);
  const links = [`${env.APP_URL}/b/${eventType.shortCode}`];
  if (me.username) links.push(`${env.APP_URL}/${me.username}/${eventType.slug}`);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{eventType.title}</h1>
          <p className="text-sm text-muted-foreground">{eventType.durationMin} minute meeting</p>
        </div>
        <DeleteEventTypeButton id={eventType.id} title={eventType.title} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Public links</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          {links.map((link) => (
            <div key={link} className="flex items-center gap-1">
              <code className="min-w-0 flex-1 truncate font-mono text-xs">{link}</code>
              <CopyButton value={link} />
            </div>
          ))}
        </CardContent>
      </Card>

      <Separator />

      <EventTypeForm
        eventTypeId={eventType.id}
        initial={eventType}
        calendars={calendars.map((c) => ({ id: c.id, label: `${c.name} — ${c.account.email}` }))}
        timezones={timezoneOptions()}
      />
    </div>
  );
}
