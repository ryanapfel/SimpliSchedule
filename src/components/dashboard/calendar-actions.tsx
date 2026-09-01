"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import {
  disconnectAccount,
  resyncAccount,
  setCalendarConflictCheck,
} from "@/app/(dashboard)/dashboard/actions";
import { ConfirmDialog } from "@/components/dashboard/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";

export function ConflictSwitch({
  calendarId,
  enabled,
}: {
  calendarId: string;
  enabled: boolean;
}) {
  const [pending, startTransition] = useTransition();
  return (
    <div className="flex items-center gap-2">
      <Switch
        id={`conflicts-${calendarId}`}
        size="sm"
        checked={enabled}
        disabled={pending}
        onCheckedChange={(next) =>
          startTransition(async () => {
            const res = await setCalendarConflictCheck(calendarId, next);
            if (!res.ok) toast.error(res.error);
          })
        }
      />
      <label htmlFor={`conflicts-${calendarId}`} className="text-xs text-muted-foreground">
        Check for conflicts
      </label>
    </div>
  );
}

export function ResyncButton({ accountId }: { accountId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const res = await resyncAccount(accountId);
          if (!res.ok) {
            toast.error(res.error);
            return;
          }
          toast.success("Calendars re-synced");
          router.refresh();
        })
      }
    >
      {pending ? "Syncing…" : "Re-sync calendars"}
    </Button>
  );
}

export function DisconnectButton({ accountId, email }: { accountId: string; email: string }) {
  const router = useRouter();
  return (
    <ConfirmDialog
      trigger={
        <Button type="button" variant="destructive" size="sm">
          Disconnect
        </Button>
      }
      title="Disconnect this account?"
      description={`${email} will stop blocking slots, and booking links pointing at its calendars will stop creating events.`}
      confirmLabel="Disconnect"
      onConfirm={async () => {
        const res = await disconnectAccount(accountId);
        if (!res.ok) {
          toast.error(res.error);
          return;
        }
        toast.success("Account disconnected");
        router.refresh();
      }}
    />
  );
}
