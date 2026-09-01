import { format } from "date-fns";
import { eq } from "drizzle-orm";
import { requireUser } from "@/auth/session";
import { ApiKeys } from "@/components/dashboard/api-keys";
import { ProfileForm } from "@/components/dashboard/profile-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/db";
import { apiKeys } from "@/db/schema";
import { env } from "@/lib/env";
import { timezoneOptions } from "@/lib/timezones";

export default async function SettingsPage() {
  const me = await requireUser();
  const keys = await db.query.apiKeys.findMany({
    where: eq(apiKeys.userId, me.id),
    orderBy: (t, { desc }) => desc(t.createdAt),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">Your public profile and API access.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>
            Your booking pages live under {env.APP_URL}/{me.username ?? "your-username"}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ProfileForm
            initial={{
              name: me.name,
              username: me.username ?? "",
              timezone: me.timezone ?? "America/Los_Angeles",
            }}
            timezones={timezoneOptions()}
            appUrl={env.APP_URL}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>API keys</CardTitle>
          <CardDescription>
            Used by the Raycast extension and the availability API. Keys are shown once at creation.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ApiKeys
            keys={keys.map((k) => ({
              id: k.id,
              name: k.name,
              prefix: k.prefix,
              created: format(k.createdAt, "MMM d, yyyy"),
              lastUsed: k.lastUsedAt ? format(k.lastUsedAt, "MMM d, yyyy") : null,
            }))}
          />
        </CardContent>
      </Card>
    </div>
  );
}
