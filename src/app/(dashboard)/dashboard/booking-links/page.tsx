import { eq } from "drizzle-orm";
import Link from "next/link";
import { requireUser } from "@/auth/session";
import { CopyButton } from "@/components/dashboard/copy-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { db } from "@/db";
import { eventTypes } from "@/db/schema";
import { env } from "@/lib/env";

export default async function EventTypesPage() {
  const me = await requireUser();
  const rows = await db.query.eventTypes.findMany({
    where: eq(eventTypes.userId, me.id),
    orderBy: (t, { asc }) => asc(t.title),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Booking links</h1>
          <p className="text-sm text-muted-foreground">The meetings people can book with you.</p>
        </div>
        <Button asChild>
          <Link href="/dashboard/booking-links/new">New booking link</Link>
        </Button>
      </div>

      {rows.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-start gap-3 py-10">
            <p className="text-sm text-muted-foreground">
              You don&apos;t have any booking links yet. Create one to start taking bookings.
            </p>
            <Button asChild>
              <Link href="/dashboard/booking-links/new">Create your first booking link</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="px-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Short link</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((et) => {
                  const shortLink = `${env.APP_URL}/b/${et.shortCode}`;
                  return (
                    <TableRow key={et.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Link
                            href={`/dashboard/booking-links/${et.id}`}
                            className="font-medium hover:underline"
                          >
                            {et.title}
                          </Link>
                          {!et.active && <Badge variant="secondary">Inactive</Badge>}
                        </div>
                        <p className="text-xs text-muted-foreground">/{et.slug}</p>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{et.durationMin} min</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <code className="font-mono text-xs">{shortLink}</code>
                          <CopyButton value={shortLink} />
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button asChild variant="ghost" size="sm">
                          <Link href={`/dashboard/booking-links/${et.id}`}>Edit</Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
