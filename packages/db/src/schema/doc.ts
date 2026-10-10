import { sql } from "drizzle-orm";
import {
  boolean,
  pgEnum,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth";
import { colleges } from "./college";
import { syncTriple } from "./helpers";

export const docAudienceEnum = pgEnum("doc_audience", ["user", "co_admin", "admin"]);

export const docKindEnum = pgEnum("doc_kind", ["guide", "faq", "changelog"]);

export const roleEnum = pgEnum("user_role", [
  "student",
  "co_admin",
  "college_admin",
  "platform_admin",
]);

/**
 * 2.6 doc — Compass, runtime-editable guide
 */
export const docs = pgTable(
  "doc",
  {
    ...syncTriple(),
    collegeId: uuid("college_id").references(() => colleges.id),
    slug: text("slug").notNull(),
    audience: docAudienceEnum("audience").default("user").notNull(),
    kind: docKindEnum("kind").default("guide").notNull(),
    title: text("title").notNull(),
    bodyMd: text("body_md").notNull(),
    orderIndex: smallint("order_index").default(0).notNull(),
    minRole: roleEnum("min_role").default("student").notNull(),
    published: boolean("published").default(true).notNull(),
  },
  (table) => [
    uniqueIndex("doc_college_slug_active_idx")
      .on(table.collegeId, table.slug)
      .where(sql`${table.deletedAt} IS NULL`),
    // NULLs are distinct in a unique index, so the one above never fires for platform
    // defaults (college_id IS NULL). This one does.
    uniqueIndex("doc_platform_slug_active_idx")
      .on(table.slug)
      .where(sql`${table.collegeId} IS NULL AND ${table.deletedAt} IS NULL`),
  ],
);

/**
 * doc_revision — version history & rollback for Compass docs
 */
export const docRevisions = pgTable("doc_revision", {
  ...syncTriple(),
  docId: uuid("doc_id")
    .notNull()
    .references(() => docs.id),
  title: text("title").notNull(),
  bodyMd: text("body_md").notNull(),
  editedBy: uuid("edited_by").references(() => user.id, { onDelete: "set null" }),
  editedAt: timestamp("edited_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
  note: text("note"),
});

export type Doc = typeof docs.$inferSelect;
export type NewDoc = typeof docs.$inferInsert;
export type DocRevision = typeof docRevisions.$inferSelect;
export type NewDocRevision = typeof docRevisions.$inferInsert;
