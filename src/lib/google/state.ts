import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";

// OAuth `state` = base64url(payload).signature so the callback can trust the user id it carries.
function sign(payload: string) {
  return createHmac("sha256", env.BETTER_AUTH_SECRET).update(payload).digest("base64url");
}

export function encodeState(userId: string) {
  const payload = Buffer.from(JSON.stringify({ userId, ts: Date.now() })).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function decodeState(state: string): { userId: string } | null {
  const [payload, sig] = state.split(".");
  if (!payload || !sig) return null;
  const expected = sign(payload);
  if (sig.length !== expected.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
    return null;
  }
  const { userId, ts } = JSON.parse(Buffer.from(payload, "base64url").toString()) as {
    userId: string;
    ts: number;
  };
  if (Date.now() - ts > 10 * 60 * 1000) return null;
  return { userId };
}
