import { z } from "zod";

export const CORE_VERSION = "0.0.1";

/**
 * Sync Triple Schema required by Rule 3:
 * id (UUID v7 / string), updated_at, deleted_at (soft deletes).
 */
export const SyncTripleSchema = z.object({
  id: z.string().min(1),
  createdAt: z.date(),
  updatedAt: z.date(),
  deletedAt: z.date().nullable().optional(),
});

export type SyncTriple = z.infer<typeof SyncTripleSchema>;

/**
 * Item Kind enum per PLAN.md §2.1
 */
export const ItemKindSchema = z.enum([
  "todo",
  "event",
  "exam",
  "holiday",
  "class_block",
  "club_meeting",
  "outfit_plan",
  "restock",
]);

export type ItemKind = z.infer<typeof ItemKindSchema>;

/**
 * Validate whether a record is active (not soft deleted).
 */
export function isRecordActive(record: { deletedAt?: Date | null }): boolean {
  return !record.deletedAt;
}

export * from "./permissions.js";
export * from "./settings.js";
export * from "./sync.js";
export * from "./docs.js";
