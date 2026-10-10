import { pgTable, timestamp, uuid } from "drizzle-orm/pg-core";
import { user } from "./auth";
import { syncTriple } from "./helpers";

/**
 * wear_event — append-only wear log per PLAN.md §3.
 *
 * Current wear count is DERIVED from counting rows, never stored as a
 * mutable integer. Two offline devices each logging a wear produce two
 * event rows and both survive reconnect — LWW cannot merge counters.
 */
export const wearEvents = pgTable("wear_event", {
  ...syncTriple(),
  userId: uuid("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  garmentId: uuid("garment_id"), // FK deferred until Drip schema (Phase 2)
  wornOn: timestamp("worn_on", { withTimezone: true, mode: "date" }),
  loggedAt: timestamp("logged_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
});

export type WearEvent = typeof wearEvents.$inferSelect;
export type NewWearEvent = typeof wearEvents.$inferInsert;
