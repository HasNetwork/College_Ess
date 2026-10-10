import { relations, sql } from "drizzle-orm";
import {
  check,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth";
import { roleEnum } from "./doc";
import { syncTriple } from "./helpers";

export const scopeTypeEnum = pgEnum("scope_type", ["platform", "college", "club"]);

// Re-export roleEnum as userRoleEnum for convenience
export const userRoleEnum = roleEnum;

/**
 * 2.7 grant — scoped permission model per PLAN.md §6
 * Authority is a grant row or it does not exist (Rule 5).
 */
export const grants = pgTable(
  "grant",
  {
    ...syncTriple(),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    permission: text("permission").notNull(), // "verb:resource", e.g. manage:club
    scopeType: scopeTypeEnum("scope_type").notNull(),
    scopeId: uuid("scope_id"), // null only when scope_type = platform
    grantedBy: uuid("granted_by").references(() => user.id, { onDelete: "set null" }),
    expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" }),
  },
  (table) => [
    check(
      "grant_scope_check",
      sql`(${table.scopeType} = 'platform' AND ${table.scopeId} IS NULL) OR (${table.scopeType} != 'platform' AND ${table.scopeId} IS NOT NULL)`,
    ),
    uniqueIndex("grant_user_permission_scope_idx")
      .on(table.userId, table.permission, table.scopeType, table.scopeId)
      .where(sql`${table.deletedAt} IS NULL`),
    // NULLs are distinct in a unique index, so the one above never fires for platform
    // grants (scope_id IS NULL), and onRoleChange's onConflictDoNothing never conflicted.
    uniqueIndex("grant_platform_permission_active_idx")
      .on(table.userId, table.permission)
      .where(sql`${table.scopeId} IS NULL AND ${table.deletedAt} IS NULL`),
    index("grant_user_id_idx").on(table.userId).where(sql`${table.deletedAt} IS NULL`),
  ],
);

export const grant = grants;

export const grantRelations = relations(grants, ({ one }) => ({
  user: one(user, {
    fields: [grants.userId],
    references: [user.id],
    relationName: "user_grants",
  }),
  granter: one(user, {
    fields: [grants.grantedBy],
    references: [user.id],
    relationName: "granter_grants",
  }),
}));

export type Grant = typeof grants.$inferSelect;
export type NewGrant = typeof grants.$inferInsert;
