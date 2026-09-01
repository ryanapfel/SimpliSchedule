import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.string().min(1),
  APP_URL: z.string().url().default("http://localhost:3000"),
  BETTER_AUTH_SECRET: z.string().min(16),
  ENCRYPTION_KEY: z.string().min(16),
  GOOGLE_CLIENT_ID: z.string().optional().default(""),
  GOOGLE_CLIENT_SECRET: z.string().optional().default(""),
  GOOGLE_LOGIN_ENABLED: z
    .string()
    .optional()
    .transform((v) => v === "true"),
  CALENDAR_PROVIDER: z.enum(["google", "none"]).default("google"),
  SINGLE_USER: z
    .string()
    .optional()
    .transform((v) => v === "true"),
});

export const env = schema.parse(process.env);
