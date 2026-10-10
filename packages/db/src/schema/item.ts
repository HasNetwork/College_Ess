import { boolean, pgEnum, pgTable, smallint, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { user } from "./auth";
import { colleges } from "./college";
import { syncTriple } from "./helpers";

export const itemKindEnum = pgEnum("item_kind", [
  "todo",
  "event",
  "exam",
  "holiday",
  "class_block",
  "club_meeting",
  "outfit_plan",
  "restock",
]);

export const itemStatusEnum = pgEnum("item_status", [
  "pending",
  "active",
  "done",
  "cancelled",
  "missed",
]);

export const itemSourceEnum = pgEnum("item_source", ["user", "college", "club", "ai", "inferred"]);

/**
 * 2.1 item — unified temporal record
 * Represents todo, event, exam, holiday, class block, club meeting, outfit plan, restock.
 */
export const items = pgTable("item", {
  ...syncTriple(),
  collegeId: uuid("college_id").references(() => colleges.id),
  userId: uuid("user_id").references(() => user.id, { onDelete: "cascade" }), // null = college-wide
  kind: itemKindEnum("kind").notNull(),
  title: text("title").notNull(),
  startsAt: timestamp("starts_at", { withTimezone: true, mode: "date" }),
  endsAt: timestamp("ends_at", { withTimezone: true, mode: "date" }),
  rrule: text("rrule"),
  allDay: boolean("all_day").default(false).notNull(),
  status: itemStatusEnum("status").default("pending").notNull(),
  priority: smallint("priority").default(0).notNull(),
  source: itemSourceEnum("source").default("user").notNull(),
});

export type Item = typeof items.$inferSelect;
export type NewItem = typeof items.$inferInsert;
