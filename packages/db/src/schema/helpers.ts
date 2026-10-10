import { timestamp, uuid } from "drizzle-orm/pg-core";
import { uuidv7 } from "uuidv7";

/**
 * Reusable columns satisfying Rule 3:
 * id (UUID v7, sortable and client-generatable),
 * created_at, updated_at, and deleted_at (soft delete).
 * Returns fresh column instances per table to avoid Drizzle column sharing mutations.
 */
export function syncTriple() {
  return {
    id: uuid("id")
      .primaryKey()
      .$defaultFn(() => uuidv7()),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
    deletedAt: timestamp("deleted_at", { withTimezone: true, mode: "date" }),
  };
}
