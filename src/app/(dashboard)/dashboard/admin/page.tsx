import { format } from "date-fns";
import { eq } from "drizzle-orm";
import { requireAdmin } from "@/auth/session";
import { RoleToggle, SignupsSwitch } from "@/components/dashboard/admin-controls";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { db } from "@/db";
import { appSettings } from "@/db/schema";
import { env } from "@/lib/env";

export default async function AdminPage() {
  const me = await requireAdmin();
  const [settings, users] = await Promise.all([
    db.query.appSettings.findFirst({ where: eq(appSettings.id, "default") }),
    db.query.user.findMany({ orderBy: (t, { asc }) => asc(t.createdAt) }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Admin</h1>
        <p className="text-sm text-muted-foreground">Instance-wide settings and accounts.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Signups</CardTitle>
          <CardDescription>
            {env.SINGLE_USER
              ? "Locked: this instance runs with SINGLE_USER=true, so no new accounts can be created."
              : "When closed, nobody new can create an account."}
          </CardDescription>
        </CardHeader>
        {!env.SINGLE_USER && (
          <CardContent>
            <SignupsSwitch open={settings?.signupsOpen ?? true} />
          </CardContent>
        )}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Users</CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Username</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Created</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => {
                const isAdmin = u.role === "admin";
                return (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">{u.name}</TableCell>
                    <TableCell className="text-muted-foreground">{u.email}</TableCell>
                    <TableCell className="text-muted-foreground">{u.username ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant={isAdmin ? "default" : "secondary"}>{isAdmin ? "admin" : "user"}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {format(u.createdAt, "MMM d, yyyy")}
                    </TableCell>
                    <TableCell className="text-right">
                      <RoleToggle userId={u.id} isAdmin={isAdmin} disabled={u.id === me.id} />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
