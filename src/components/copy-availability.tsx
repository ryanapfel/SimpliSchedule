"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { timezoneOptions } from "@/lib/timezones";

type Props = {
  eventTypes: { id: string; title: string; slug: string }[];
  defaultTimezone: string;
};

export function CopyAvailability({ eventTypes, defaultTimezone }: Props) {
  const [eventType, setEventType] = useState(eventTypes[0]?.slug ?? "");
  const [days, setDays] = useState("5");
  const [tz, setTz] = useState(defaultTimezone);
  const [text, setText] = useState("");
  const [html, setHtml] = useState("");
  const [pending, start] = useTransition();

  useEffect(() => {
    if (!eventType) return;
    start(async () => {
      const q = new URLSearchParams({ eventType, days, tz, format: "json" });
      const res = await fetch(`/api/availability/text?${q}`);
      if (!res.ok) {
        setText(`Error: ${await res.text()}`);
        setHtml("");
        return;
      }
      const data = (await res.json()) as { text: string; html: string };
      setText(data.text);
      setHtml(data.html);
    });
  }, [eventType, days, tz]);

  // Rich text so each time block is a link when pasted into email; plain text everywhere else.
  async function copy() {
    if (html && typeof ClipboardItem !== "undefined") {
      await navigator.clipboard.write([
        new ClipboardItem({
          "text/plain": new Blob([text], { type: "text/plain" }),
          "text/html": new Blob([html], { type: "text/html" }),
        }),
      ]);
    } else {
      await navigator.clipboard.writeText(text);
    }
    toast.success("Availability copied");
  }

  if (eventTypes.length === 0) {
    return <p className="text-sm text-muted-foreground">Create an booking link to generate availability text.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Booking link">
          <Select value={eventType} onValueChange={setEventType}>
            <SelectTrigger className="w-full" aria-label="Booking link">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {eventTypes.map((e) => (
                <SelectItem key={e.id} value={e.slug}>
                  {e.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Days ahead">
          <Select value={days} onValueChange={setDays}>
            <SelectTrigger className="w-full" aria-label="Days ahead">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {["3", "5", "7", "10", "14"].map((d) => (
                <SelectItem key={d} value={d}>
                  {d} days
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Timezone">
          <Select value={tz} onValueChange={setTz}>
            <SelectTrigger className="w-full" aria-label="Timezone">
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
        </Field>
      </div>
      <Textarea value={pending && !text ? "Loading…" : text} readOnly rows={9} className="font-mono text-sm" />
      <div className="flex items-center gap-3">
        <Button onClick={copy} disabled={pending || !text}>
          Copy to clipboard
        </Button>
        <p className="text-xs text-muted-foreground">Pasted into email, each time block links to booking that block.</p>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
