import { notFound, permanentRedirect } from "next/navigation";
import { eventTypeByShortCode } from "@/lib/booking";

type Props = { params: Promise<{ code: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function ShortLink({ params, searchParams }: Props) {
  const { code } = await params;
  const et = await eventTypeByShortCode(code);
  if (!et?.user.username) notFound();
  // Keep ?date/from/to/tz from availability-text links.
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(await searchParams)) if (typeof v === "string") q.set(k, v);
  const suffix = q.size ? `?${q}` : "";
  permanentRedirect(`/${et.user.username}/${et.slug}${suffix}`);
}
