import { count, eq } from "drizzle-orm";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { admin } from "better-auth/plugins";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { appSettings, user } from "@/db/schema";
import { env } from "@/lib/env";
import { slugify } from "@/lib/ids";

async function signupsOpen() {
  const row = await db.query.appSettings.findFirst({ where: eq(appSettings.id, "default") });
  return row?.signupsOpen ?? true;
}

async function uniqueUsername(email: string) {
  const base = slugify(email.split("@")[0]) || "user";
  for (let i = 0; ; i++) {
    const candidate = i === 0 ? base : `${base}${i}`;
    const taken = await db.query.user.findFirst({ where: eq(user.username, candidate) });
    if (!taken) return candidate;
  }
}

export const auth = betterAuth({
  baseURL: env.APP_URL,
  secret: env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, { provider: "pg", schema, schemaName: "scheduling" }),
  emailAndPassword: { enabled: true },
  socialProviders:
    env.GOOGLE_LOGIN_ENABLED && env.GOOGLE_CLIENT_ID
      ? {
          google: {
            clientId: env.GOOGLE_CLIENT_ID,
            clientSecret: env.GOOGLE_CLIENT_SECRET,
          },
        }
      : {},
  user: {
    additionalFields: {
      username: { type: "string", required: false, input: false },
      timezone: { type: "string", required: false, defaultValue: "America/Los_Angeles" },
    },
  },
  databaseHooks: {
    user: {
      create: {
        // The first account on an instance becomes admin; later signups need signups to be open.
        before: async (data) => {
          const [{ value: total }] = await db.select({ value: count() }).from(user);
          if (total > 0 && !(await signupsOpen())) {
            throw new APIError("FORBIDDEN", { message: "Signups are closed on this instance." });
          }
          return {
            data: {
              ...data,
              role: total === 0 ? "admin" : "user",
              username: await uniqueUsername(data.email),
            },
          };
        },
      },
    },
  },
  plugins: [admin(), nextCookies()],
});

export type Session = typeof auth.$Infer.Session;
export type SessionUser = Session["user"];
