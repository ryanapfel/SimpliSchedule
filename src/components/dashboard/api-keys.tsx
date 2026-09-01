"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { createApiKeyAction, deleteApiKey } from "@/app/(dashboard)/dashboard/actions";
import { ConfirmDialog } from "@/components/dashboard/confirm-dialog";
import { CopyButton } from "@/components/dashboard/copy-button";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export type ApiKeyRow = {
  id: string;
  name: string;
  prefix: string;
  created: string;
  lastUsed: string | null;
};

export function ApiKeys({ keys }: { keys: ApiKeyRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [created, setCreated] = useState<string | null>(null);

  function create(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startTransition(async () => {
      const res = await createApiKeyAction(name);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setName("");
      if (res.data) setCreated(res.data.key);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      {keys.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Prefix</TableHead>
              <TableHead>Created</TableHead>
              <TableHead>Last used</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {keys.map((key) => (
              <TableRow key={key.id}>
                <TableCell className="font-medium">{key.name}</TableCell>
                <TableCell className="font-mono text-xs">{key.prefix}…</TableCell>
                <TableCell className="text-muted-foreground">{key.created}</TableCell>
                <TableCell className="text-muted-foreground">{key.lastUsed ?? "Never"}</TableCell>
                <TableCell className="text-right">
                  <ConfirmDialog
                    trigger={
                      <Button type="button" variant="ghost" size="sm">
                        Delete
                      </Button>
                    }
                    title="Delete API key?"
                    description={`Anything using “${key.name}” will stop working immediately.`}
                    confirmLabel="Delete"
                    onConfirm={async () => {
                      const res = await deleteApiKey(key.id);
                      if (!res.ok) {
                        toast.error(res.error);
                        return;
                      }
                      toast.success("Key deleted");
                      router.refresh();
                    }}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <form onSubmit={create} className="flex flex-wrap items-center gap-2">
        <Input
          aria-label="Key name"
          placeholder="Raycast"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="sm:max-w-xs"
        />
        <Button type="submit" disabled={pending}>
          {pending ? "Creating…" : "Create key"}
        </Button>
      </form>

      <Dialog open={created !== null} onOpenChange={(open) => !open && setCreated(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Your new API key</DialogTitle>
            <DialogDescription>
              Copy it now — it won&apos;t be shown again.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2 rounded-lg border bg-muted/50 p-2">
            <code className="min-w-0 flex-1 break-all font-mono text-xs">{created}</code>
            <CopyButton value={created ?? ""} message="Key copied" />
          </div>
          <p className="text-xs text-muted-foreground">
            Add this key to <code className="font-mono">~/.config/scheduling/env</code> as{" "}
            <code className="font-mono">SCHEDULING_API_KEY=…</code>
          </p>
        </DialogContent>
      </Dialog>
    </div>
  );
}
