import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BookingPage, type Preselect } from "@/components/booking-page";
import { eventTypeBySlug } from "@/lib/booking";

type Props = {
  params: Promise<{ username: string; slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/** ?date=YYYY-MM-DD&from=HH:mm&to=HH:mm&tz=Zone from availability-text links; ignored unless well-formed. */
function parsePreselect(q: Record<string, string | string[] | undefined>): Preselect | null {
  const { date, from, to, tz } = q;
  if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const time = (v: unknown) => (typeof v === "string" && /^\d{2}:\d{2}$/.test(v) ? v : null);
  let zone: string | null = null;
  if (typeof tz === "string") {
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: tz });
      zone = tz;
    } catch {}
  }
  return { date, from: time(from), to: time(to), tz: zone };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username, slug } = await params;
  const found = await eventTypeBySlug(username, slug);
  return { title: found ? `${found.eventType.title} · ${found.owner.name}` : "Not found" };
}

export default async function PublicBookingPage({ params, searchParams }: Props) {
  const { username, slug } = await params;
  const preselect = parsePreselect(await searchParams);
  const found = await eventTypeBySlug(username, slug);
  if (!found) notFound();
  const { eventType: et, owner } = found;
  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/40 p-4 sm:p-8">
      <BookingPage
        username={username}
        slug={slug}
        hostName={owner.name}
        title={et.title}
        description={et.description}
        durationMin={et.durationMin}
        maxDaysAhead={et.maxDaysAhead}
        location={et.location}
        addMeet={et.addMeet && Boolean(et.destinationCalendarId)}
        preselect={preselect}
      />
    </main>
  );
}
