"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { setSignupsOpen, setUserRole } from "@/app/(dashboard)/dashboard/actions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export function SignupsSwitch({ open }: { open: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <div className="flex items-center gap-3">
      <Switch
        id="signups"
        checked={open}
        disabled={pending}
        onCheckedChange={(next) =>
          startTransition(async () => {
            const res = await setSignupsOpen(next);
            if (!res.ok) {
              toast.error(res.error);
              return;
            }
            toast.success(next ? "Signups open" : "Signups closed");
            router.refresh();
          })
        }
      />
      <Label htmlFor="signups" className="font-normal">
        Allow new signups
      </Label>
    </div>
  );
}

export function RoleToggle({
  userId,
  isAdmin,
  disabled,
}: {
  userId: string;
  isAdmin: boolean;
  disabled: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      disabled={disabled || pending}
      onClick={() =>
        startTransition(async () => {
          const res = await setUserRole(userId, isAdmin ? "user" : "admin");
          if (!res.ok) {
            toast.error(res.error);
            return;
          }
          toast.success("Role updated");
          router.refresh();
        })
      }
    >
      {isAdmin ? "Remove admin" : "Make admin"}
    </Button>
  );
}
