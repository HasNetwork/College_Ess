import { pgTable, text } from "drizzle-orm/pg-core";
import { syncTriple } from "./helpers";

/**
 * Tenancy Root: college
 * Every shared row references college_id per PLAN.md §1
 */
export const colleges = pgTable("college", {
  ...syncTriple(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  domain: text("domain"),
});

export type College = typeof colleges.$inferSelect;
export type NewCollege = typeof colleges.$inferInsert;
