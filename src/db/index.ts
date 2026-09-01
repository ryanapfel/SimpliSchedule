import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "@/lib/env";
import * as schema from "./schema";

const globalForDb = globalThis as unknown as { pgClient?: ReturnType<typeof postgres> };

// Small pool per process: on serverless hosts every warm instance holds its own pool, and Supabase's
// pooler caps total clients. `prepare: false` keeps it compatible with transaction-mode pooling.
const client =
  globalForDb.pgClient ?? postgres(env.DATABASE_URL, { prepare: false, max: 3, idle_timeout: 20, connect_timeout: 10 });
if (process.env.NODE_ENV !== "production") globalForDb.pgClient = client;

export const db = drizzle(client, { schema });
export type Db = typeof db;
