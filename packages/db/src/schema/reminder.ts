import { boolean, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { user } from "./auth";
import { syncTriple } from "./helpers";

export const reminderTriggerKindEnum = pgEnum("reminder_trigger_kind", [
  "relative",
  "absolute",
  "geofence",
  "recurring",
]);

export const reminderChannelEnum = pgEnum("reminder_channel", ["push", "inapp", "email"]);

/**
 * 2.3 reminder — notification engine
 */
export const reminders = pgTable("reminder", {
  ...syncTriple(),
  userId: uuid("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  subjectType: text("subject_type").notNull(),
  subjectId: uuid("subject_id").notNull(),
  triggerKind: reminderTriggerKindEnum("trigger_kind").notNull(),
  triggerValue: text("trigger_value").notNull(),
  channel: reminderChannelEnum("channel").notNull(),
  forced: boolean("forced").default(false).notNull(),
  enabled: boolean("enabled").default(true).notNull(),
  nextFireAt: timestamp("next_fire_at", { withTimezone: true, mode: "date" }),
  lastFiredAt: timestamp("last_fired_at", { withTimezone: true, mode: "date" }),
});

export type Reminder = typeof reminders.$inferSelect;
export type NewReminder = typeof reminders.$inferInsert;

/**
 * Push Subscriptions — Web Push per user per device
 */
export const pushSubscriptions = pgTable("push_subscription", {
  ...syncTriple(),
  userId: uuid("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  endpoint: text("endpoint").notNull().unique(),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  userAgent: text("user_agent"),
});

export type PushSubscription = typeof pushSubscriptions.$inferSelect;
export type NewPushSubscription = typeof pushSubscriptions.$inferInsert;
