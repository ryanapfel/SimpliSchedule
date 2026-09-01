"use client";

import { CheckIcon, CopyIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

/** Copies `value` to the clipboard and confirms with a toast. */
export function CopyButton({ value, message = "Link copied" }: { value: string; message?: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
      toast.success(message);
    } catch {
      toast.error("Couldn't copy to clipboard");
    }
  }

  return (
    <Button type="button" variant="ghost" size="icon-sm" onClick={copy} aria-label="Copy">
      {copied ? <CheckIcon /> : <CopyIcon />}
    </Button>
  );
}
