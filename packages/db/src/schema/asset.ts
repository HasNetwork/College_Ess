import { bigint, integer, jsonb, pgEnum, pgTable, text, uuid } from "drizzle-orm/pg-core";
import { user } from "./auth";
import { syncTriple } from "./helpers";

export const assetScanStatusEnum = pgEnum("asset_scan_status", [
  "pending",
  "clean",
  "infected",
  "failed",
]);

/**
 * 2.4 asset — upload pipeline
 */
export const assets = pgTable("asset", {
  ...syncTriple(),
  ownerId: uuid("owner_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  bucketKey: text("bucket_key").notNull(),
  mime: text("mime").notNull(),
  bytes: bigint("bytes", { mode: "number" }).notNull(),
  width: integer("width"),
  height: integer("height"),
  variants: jsonb("variants"),
  scanStatus: assetScanStatusEnum("scan_status").default("pending").notNull(),
});

export type Asset = typeof assets.$inferSelect;
export type NewAsset = typeof assets.$inferInsert;
