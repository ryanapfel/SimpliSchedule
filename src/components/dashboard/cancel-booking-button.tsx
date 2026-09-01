"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { cancelBooking } from "@/app/(dashboard)/dashboard/actions";
import { ConfirmDialog } from "@/components/dashboard/confirm-dialog";
import { Button } from "@/components/ui/button";

export function CancelBookingButton({ id, when }: { id: string; when: string }) {
  const router = useRouter();
  return (
    <ConfirmDialog
      trigger={
        <Button type="button" variant="ghost" size="sm">
          Cancel
        </Button>
      }
      title="Cancel this booking?"
      description={`${when} — the booker is notified and the calendar event is removed.`}
      confirmLabel="Cancel booking"
      onConfirm={async () => {
        const res = await cancelBooking(id);
        if (!res.ok) {
          toast.error(res.error);
          return;
        }
        toast.success("Booking cancelled");
        router.refresh();
      }}
    />
  );
}
