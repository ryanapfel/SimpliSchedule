import { eq } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import { db } from "@/db";
import { apiKeys } from "@/db/schema";
import { sha256 } from "@/lib/crypto";
import { newId } from "@/lib/ids";

const PREFIX = "sched_";

/** Creates a key and returns the plaintext once; only its hash is stored. */
export async function createApiKey(userId: string, name: string) {
  const plaintext = PREFIX + randomBytes(24).toString("base64url");
  await db.insert(apiKeys).values({
    id: newId(),
    userId,
    name,
    prefix: plaintext.slice(0, 12),
    keyHash: sha256(plaintext),
  });
  return plaintext;
}

export async function findUserIdByApiKey(plaintext: string): Promise<string | null> {
  if (!plaintext.startsWith(PREFIX)) return null;
  const row = await db.query.apiKeys.findFirst({
    where: eq(apiKeys.keyHash, sha256(plaintext)),
  });
  if (!row) return null;
  await db.update(apiKeys).set({ lastUsedAt: new Date() }).where(eq(apiKeys.id, row.id));
  return row.userId;
}
