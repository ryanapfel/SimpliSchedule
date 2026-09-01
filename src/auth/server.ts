import { eq } from "drizzle-orm";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { admin } from "better-auth/plugins";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { user } from "@/db/schema";
import { env } from "@/lib/env";
import { slugify } from "@/lib/ids";
import { signupState } from "./signups";

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
        // Runs for email and Google signups alike.
        before: async (data) => {
          const { allowed, first } = await signupState();
          if (!allowed) {
            throw new APIError("FORBIDDEN", { message: "Signups are closed on this instance." });
          }
          return {
            data: {
              ...data,
              role: first ? "admin" : "user",
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
