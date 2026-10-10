import { pgEnum, pgTable, text, uuid } from "drizzle-orm/pg-core";
import { user } from "./auth";
import { syncTriple } from "./helpers";

export const linkRelationEnum = pgEnum("link_relation", [
  "prepares_for",
  "wears_at",
  "belongs_to",
  "blocks",
  "derived_from",
  "attended",
]);

/**
 * 2.2 link — typed edges between anything
 */
export const links = pgTable("link", {
  ...syncTriple(),
  // The tenancy column: a link had no owner and no college, so nothing could scope it and
  // any student could read or rewrite every link in every college (0.5-2 §1). Not null on
  // purpose: an ownerless row is exactly the shape the old guard waved through.
  userId: uuid("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  fromType: text("from_type").notNull(),
  fromId: uuid("from_id").notNull(),
  toType: text("to_type").notNull(),
  toId: uuid("to_id").notNull(),
  relation: linkRelationEnum("relation").notNull(),
});

export type Link = typeof links.$inferSelect;
export type NewLink = typeof links.$inferInsert;
