"use client";

import { deleteEventType } from "@/app/(dashboard)/dashboard/actions";
import { ConfirmDialog } from "@/components/dashboard/confirm-dialog";
import { Button } from "@/components/ui/button";

export function DeleteEventTypeButton({ id, title }: { id: string; title: string }) {
  return (
    <ConfirmDialog
      trigger={
        <Button type="button" variant="destructive">
          Delete
        </Button>
      }
      title="Delete booking link?"
      description={`“${title}” and its bookings will be removed. This can't be undone.`}
      confirmLabel="Delete"
      onConfirm={() => deleteEventType(id)}
    />
  );
}
