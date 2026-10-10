import { jsonb, pgEnum, pgTable, text, uuid } from "drizzle-orm/pg-core";
import { user } from "./auth";
import { colleges } from "./college";
import { syncTriple } from "./helpers";

export const suggestionStatusEnum = pgEnum("suggestion_status", [
  "pending",
  "approved",
  "rejected",
]);

/**
 * 2.5 suggestion — moderation queue
 */
export const suggestions = pgTable("suggestion", {
  ...syncTriple(),
  collegeId: uuid("college_id")
    .notNull()
    .references(() => colleges.id),
  targetType: text("target_type").notNull(),
  targetId: uuid("target_id"),
  proposedDiff: jsonb("proposed_diff").notNull(),
  submittedBy: uuid("submitted_by")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  status: suggestionStatusEnum("status").default("pending").notNull(),
  reviewedBy: uuid("reviewed_by").references(() => user.id, { onDelete: "set null" }),
  reviewNote: text("review_note"),
});

export type Suggestion = typeof suggestions.$inferSelect;
export type NewSuggestion = typeof suggestions.$inferInsert;
