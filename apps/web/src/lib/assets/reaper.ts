import { type DbClient, schema } from "@clg-ess/db";
import { and, eq, isNull, lt } from "drizzle-orm";
import { deleteObjectFromStorage } from "./storage";
import { DELETED_ASSET_GRACE_MS } from "./validation";

export interface ReapOptions {
  pendingMaxAgeMs?: number; // Default 24 hours (24 * 60 * 60 * 1000)
  gracePeriodMs?: number; // Default DELETED_ASSET_GRACE_MS (7 days)
}

export interface ReapResult {
  stalePendingCount: number;
  hardDeletedCount: number;
}

/**
 * Sweeps orphaned assets to protect the bucket's 10 GB free storage:
 * 1. Rows stuck in 'pending' older than 24h (client initiated presign but never completed).
 * 2. Soft-deleted rows past the grace period (hard deletes DB row and deletes object from storage).
 *
 * CRITICAL SAFETY:
 * NEVER touches live, clean, active assets (scanStatus = 'clean' and deletedAt IS NULL).
 */
export async function reapOrphanedAssets(
  db: DbClient,
  options: ReapOptions = {},
): Promise<ReapResult> {
  const now = Date.now();
  const pendingMaxAgeMs = options.pendingMaxAgeMs ?? 24 * 60 * 60 * 1000; // 24h
  const gracePeriodMs = options.gracePeriodMs ?? DELETED_ASSET_GRACE_MS;

  const pendingCutoff = new Date(now - pendingMaxAgeMs);
  const graceCutoff = new Date(now - gracePeriodMs);

  // 1. Find stale pending rows (older than 24h and not soft-deleted)
  const stalePendingRows = await db
    .select()
    .from(schema.assets)
    .where(
      and(
        eq(schema.assets.scanStatus, "pending"),
        isNull(schema.assets.deletedAt),
        lt(schema.assets.createdAt, pendingCutoff),
      ),
    );

  let stalePendingCount = 0;
  for (const asset of stalePendingRows) {
    // Clean up any partially uploaded object in storage
    await deleteObjectFromStorage(asset.bucketKey);

    // Soft delete the stale pending row
    await db
      .update(schema.assets)
      .set({
        deletedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(schema.assets.id, asset.id));

    stalePendingCount++;
  }

  // 2. Find soft-deleted assets older than grace period for permanent purge
  const expiredDeletedRows = await db
    .select()
    .from(schema.assets)
    .where(and(lt(schema.assets.deletedAt, graceCutoff)));

  let hardDeletedCount = 0;
  for (const asset of expiredDeletedRows) {
    // Delete object from storage
    await deleteObjectFromStorage(asset.bucketKey);

    // Hard delete row from DB
    await db.delete(schema.assets).where(eq(schema.assets.id, asset.id));
    hardDeletedCount++;
  }

  return {
    stalePendingCount,
    hardDeletedCount,
  };
}
