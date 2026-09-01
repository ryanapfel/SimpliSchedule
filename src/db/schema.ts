import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgSchema,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

/** Every table lives in this Postgres schema so the app can share a database with other apps. */
export const scheduling = pgSchema("scheduling");

// ---------------------------------------------------------------------------
// Auth tables (managed by better-auth; field names must match its expectations)
// ---------------------------------------------------------------------------

export const user = scheduling.table("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  image: text("image"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
  // admin plugin
  role: text("role"),
  banned: boolean("banned").default(false),
  banReason: text("ban_reason"),
  banExpires: timestamp("ban_expires"),
  // app fields
  username: text("username").unique(),
  timezone: text("timezone").default("America/Los_Angeles"),
});

export const session = scheduling.table(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at").notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .$onUpdate(() => new Date())
      .notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    impersonatedBy: text("impersonated_by"),
  },
  (t) => [index("session_user_id_idx").on(t.userId)],
);

export const account = scheduling.table(
  "account",
  {
    id: text("id").primaryKey(),
    issuer: text("issuer").notNull(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at"),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [
    index("account_user_id_idx").on(t.userId),
    uniqueIndex("account_issuer_account_id_uq").on(t.issuer, t.accountId),
  ],
);

export const verification = scheduling.table(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [index("verification_identifier_idx").on(t.identifier)],
);

// ---------------------------------------------------------------------------
// App tables
// ---------------------------------------------------------------------------

/** Singleton row (id = 'default') holding instance-wide settings. */
export const appSettings = scheduling.table("app_settings", {
  id: text("id").primaryKey().default("default"),
  signupsOpen: boolean("signups_open").default(true).notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

/** A connected external calendar account (one Google account = one row). */
export const calendarAccounts = scheduling.table(
  "calendar_accounts",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    provider: text("provider").notNull().default("google"),
    providerAccountId: text("provider_account_id").notNull(),
    email: text("email").notNull(),
    refreshTokenEnc: text("refresh_token_enc").notNull(),
    accessTokenEnc: text("access_token_enc"),
    accessTokenExpiresAt: timestamp("access_token_expires_at"),
    scope: text("scope"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("calendar_accounts_user_provider_account_uq").on(
      t.userId,
      t.provider,
      t.providerAccountId,
    ),
  ],
);

/** An individual calendar inside a connected account. */
export const calendars = scheduling.table(
  "calendars",
  {
    id: text("id").primaryKey(),
    calendarAccountId: text("calendar_account_id")
      .notNull()
      .references(() => calendarAccounts.id, { onDelete: "cascade" }),
    externalId: text("external_id").notNull(),
    name: text("name").notNull(),
    isPrimary: boolean("is_primary").default(false).notNull(),
    /** Busy time on this calendar blocks slots. */
    checkForConflicts: boolean("check_for_conflicts").default(true).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [uniqueIndex("calendars_account_external_uq").on(t.calendarAccountId, t.externalId)],
);

export type TimeRange = { start: string; end: string }; // "HH:mm" in the event type's timezone
/** Keys are weekday numbers 0 (Sunday) .. 6 (Saturday). */
export type WeeklyAvailability = Partial<Record<"0" | "1" | "2" | "3" | "4" | "5" | "6", TimeRange[]>>;

export const eventTypes = scheduling.table(
  "event_types",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    slug: text("slug").notNull(),
    shortCode: text("short_code").notNull().unique(),
    description: text("description"),
    durationMin: integer("duration_min").notNull().default(30),
    slotIntervalMin: integer("slot_interval_min").notNull().default(30),
    bufferBeforeMin: integer("buffer_before_min").notNull().default(0),
    bufferAfterMin: integer("buffer_after_min").notNull().default(0),
    minNoticeMin: integer("min_notice_min").notNull().default(120),
    /** How far ahead bookers may book. */
    maxDaysAhead: integer("max_days_ahead").notNull().default(30),
    timezone: text("timezone").notNull(),
    availability: jsonb("availability").$type<WeeklyAvailability>().notNull(),
    destinationCalendarId: text("destination_calendar_id").references(() => calendars.id, {
      onDelete: "set null",
    }),
    addMeet: boolean("add_meet").default(true).notNull(),
    location: text("location"),
    active: boolean("active").default(true).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [uniqueIndex("event_types_user_slug_uq").on(t.userId, t.slug)],
);

export const bookings = scheduling.table(
  "bookings",
  {
    id: text("id").primaryKey(),
    eventTypeId: text("event_type_id")
      .notNull()
      .references(() => eventTypes.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    startAt: timestamp("start_at", { withTimezone: true }).notNull(),
    endAt: timestamp("end_at", { withTimezone: true }).notNull(),
    bookerName: text("booker_name").notNull(),
    bookerEmail: text("booker_email").notNull(),
    bookerTimezone: text("booker_timezone"),
    notes: text("notes"),
    status: text("status", { enum: ["confirmed", "cancelled"] })
      .notNull()
      .default("confirmed"),
    googleEventId: text("google_event_id"),
    googleCalendarId: text("google_calendar_id"),
    meetUrl: text("meet_url"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("bookings_user_start_idx").on(t.userId, t.startAt)],
);

export const apiKeys = scheduling.table("api_keys", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  /** First 12 chars of the key, shown in the UI to identify it. */
  prefix: text("prefix").notNull(),
  keyHash: text("key_hash").notNull().unique(),
  lastUsedAt: timestamp("last_used_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ---------------------------------------------------------------------------
// Relations
// ---------------------------------------------------------------------------

export const userRelations = relations(user, ({ many }) => ({
  sessions: many(session),
  accounts: many(account),
  calendarAccounts: many(calendarAccounts),
  eventTypes: many(eventTypes),
}));

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, { fields: [session.userId], references: [user.id] }),
}));

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, { fields: [account.userId], references: [user.id] }),
}));

export const calendarAccountRelations = relations(calendarAccounts, ({ one, many }) => ({
  user: one(user, { fields: [calendarAccounts.userId], references: [user.id] }),
  calendars: many(calendars),
}));

export const calendarRelations = relations(calendars, ({ one }) => ({
  account: one(calendarAccounts, {
    fields: [calendars.calendarAccountId],
    references: [calendarAccounts.id],
  }),
}));

export const eventTypeRelations = relations(eventTypes, ({ one, many }) => ({
  user: one(user, { fields: [eventTypes.userId], references: [user.id] }),
  destinationCalendar: one(calendars, {
    fields: [eventTypes.destinationCalendarId],
    references: [calendars.id],
  }),
  bookings: many(bookings),
}));

export const bookingRelations = relations(bookings, ({ one }) => ({
  eventType: one(eventTypes, { fields: [bookings.eventTypeId], references: [eventTypes.id] }),
}));

export type User = typeof user.$inferSelect;
export type CalendarAccount = typeof calendarAccounts.$inferSelect;
export type Calendar = typeof calendars.$inferSelect;
export type EventType = typeof eventTypes.$inferSelect;
export type Booking = typeof bookings.$inferSelect;
export type ApiKey = typeof apiKeys.$inferSelect;
