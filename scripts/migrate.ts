/**
 * Applies the SQL migrations in ./drizzle to DATABASE_URL.
 * Everything is created inside the `scheduling` Postgres schema; the migration
 * bookkeeping table is also kept there so the public schema stays untouched.
 */
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

const client = postgres(url, { max: 1, onnotice: () => {} });
const db = drizzle(client);

await migrate(db, { migrationsFolder: "./drizzle", migrationsSchema: "scheduling" });
console.log("Migrations applied.");
await client.end();
