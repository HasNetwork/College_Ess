import { resolve } from "node:path";
import { DeleteObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { schema } from "@clg-ess/db";
import { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { uuidv7 } from "uuidv7";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { reapOrphanedAssets } from "../src/lib/assets/reaper";
import { createPresignedUploadUrl, createPresignedViewUrl } from "../src/lib/assets/storage";
import {
  deriveBucketKey,
  getMaxBytesForPurpose,
  isAllowedMimeType,
} from "../src/lib/assets/validation";

describe("Phase 0-6 Asset Pipeline Tests", () => {
  let db: ReturnType<typeof drizzle<typeof schema>>;
  let userA: schema.User;

  beforeAll(async () => {
    const client = new PGlite();
    db = drizzle(client, { schema });
    const migrationsFolder = resolve(__dirname, "../../../packages/db/drizzle");
    await migrate(db, { migrationsFolder });

    // Seed test user
    const [u1] = await db
      .insert(schema.user)
      .values({
        name: "Student One",
        email: "student1@clg.edu",
      })
      .returning();

    if (!u1) {
      throw new Error("Failed to seed test user");
    }

    userA = u1;
  }, 30000);

  /** Stubs the storage edge and records the key of every object the code deletes. */
  function recordStorageDeletes(): string[] {
    const deleted: string[] = [];
    vi.spyOn(S3Client.prototype, "send").mockImplementation(async (command: unknown) => {
      if (command instanceof DeleteObjectCommand) deleted.push(command.input.Key ?? "");
      return {};
    });
    return deleted;
  }

  describe("Validation & Key Derivation", () => {
    it("enforces mime allowlist and rejects disallowed types", () => {
      expect(isAllowedMimeType("image/webp")).toBe(true);
      expect(isAllowedMimeType("image/jpeg")).toBe(true);
      expect(isAllowedMimeType("image/png")).toBe(true);
      expect(isAllowedMimeType("application/pdf")).toBe(true);

      // Disallowed types
      expect(isAllowedMimeType("application/x-msdownload")).toBe(false);
      expect(isAllowedMimeType("image/bmp")).toBe(false);
      expect(isAllowedMimeType("text/html")).toBe(false);
      expect(isAllowedMimeType("application/javascript")).toBe(false);
    });

    it("enforces max size limits per purpose", () => {
      expect(getMaxBytesForPurpose("profile_photo")).toBe(1024 * 1024);
      expect(getMaxBytesForPurpose("garment_photo")).toBe(2 * 1024 * 1024);
      expect(getMaxBytesForPurpose("attachment")).toBe(5 * 1024 * 1024);
      expect(getMaxBytesForPurpose("unknown")).toBe(5 * 1024 * 1024);
    });

    it("derives server-controlled bucket key and ignores client-supplied paths", () => {
      const derived = deriveBucketKey(userA.id, "image/webp", "garment_photo");
      expect(derived.startsWith(`users/${userA.id}/garment_photo/`)).toBe(true);
      expect(derived.endsWith(".webp")).toBe(true);

      // Verify UUID v7 in the path
      const parts = derived.split("/");
      const filename = parts[parts.length - 1];
      expect(filename?.length).toBeGreaterThan(20);
    });
  });

  describe("Presigned URL Generation", () => {
    it("generates presigned PUT and GET URLs", async () => {
      const key = deriveBucketKey(userA.id, "image/png", "profile");
      const putUrl = await createPresignedUploadUrl(key, "image/png", 1024, 3600);
      expect(putUrl).toBeDefined();
      expect(putUrl).toContain(key);

      const getUrl = await createPresignedViewUrl(key, 3600);
      expect(getUrl).toBeDefined();
      expect(getUrl).toContain(key);
    });
  });

  // The access-control tests that lived here compared ownerId to a user id inside the test
  // body and never called a route (R17). Their boundary rewrite: tests/assets-routes.test.ts.

  // The quota test that lived here added two numbers in the test body and compared them
  // to the constant, so it passed with the route's check deleted (R17). Its boundary
  // rewrite: "refuses an upload that would pass your storage quota" in assets-routes.test.ts.

  describe("Orphan Reaper", () => {
    it("reaps 24h-old pending rows but leaves live assets untouched", async () => {
      const now = Date.now();
      const staleDate = new Date(now - 25 * 60 * 60 * 1000); // 25 hours ago

      // 1. Stale pending row (abandoned upload)
      const staleAssetId = uuidv7();
      await db.insert(schema.assets).values({
        id: staleAssetId,
        ownerId: userA.id,
        bucketKey: `users/${userA.id}/test/stale.webp`,
        mime: "image/webp",
        bytes: 200000,
        scanStatus: "pending",
        createdAt: staleDate,
        updatedAt: staleDate,
      });

      // 2. Live clean asset (uploaded and completed)
      const liveAssetId = uuidv7();
      await db.insert(schema.assets).values({
        id: liveAssetId,
        ownerId: userA.id,
        bucketKey: `users/${userA.id}/test/live.webp`,
        mime: "image/webp",
        bytes: 200000,
        scanStatus: "clean",
        createdAt: staleDate,
        updatedAt: staleDate,
      });

      // 3. Recent pending asset (< 24h old, e.g. 5 minutes ago)
      const recentPendingId = uuidv7();
      await db.insert(schema.assets).values({
        id: recentPendingId,
        ownerId: userA.id,
        bucketKey: `users/${userA.id}/test/recent.webp`,
        mime: "image/webp",
        bytes: 200000,
        scanStatus: "pending",
        createdAt: new Date(now - 5 * 60 * 1000),
      });

      // Run reaper
      const deletedFromStorage = recordStorageDeletes();
      // biome-ignore lint/suspicious/noExplicitAny: polymorphic db client
      const reapResult = await reapOrphanedAssets(db as any, {
        pendingMaxAgeMs: 24 * 60 * 60 * 1000,
        gracePeriodMs: 7 * 24 * 60 * 60 * 1000,
      });

      expect(reapResult.stalePendingCount).toBeGreaterThanOrEqual(1);

      // The abandoned upload's object is removed from storage (the quota the reaper
      // protects); live and still-uploading objects are never touched.
      expect(deletedFromStorage).toContain(`users/${userA.id}/test/stale.webp`);
      expect(deletedFromStorage).not.toContain(`users/${userA.id}/test/live.webp`);
      expect(deletedFromStorage).not.toContain(`users/${userA.id}/test/recent.webp`);

      // Verify stale asset was soft-deleted
      const [staleCheck] = await db
        .select()
        .from(schema.assets)
        .where(eq(schema.assets.id, staleAssetId));
      expect(staleCheck?.deletedAt).not.toBeNull();

      // Verify live asset was NOT touched (must remain clean and active)
      const [liveCheck] = await db
        .select()
        .from(schema.assets)
        .where(eq(schema.assets.id, liveAssetId));
      expect(liveCheck?.deletedAt).toBeNull();
      expect(liveCheck?.scanStatus).toBe("clean");

      // Verify recent pending asset was NOT touched (not yet 24h old)
      const [recentCheck] = await db
        .select()
        .from(schema.assets)
        .where(eq(schema.assets.id, recentPendingId));
      expect(recentCheck?.deletedAt).toBeNull();
      expect(recentCheck?.scanStatus).toBe("pending");
    });

    it("hard-deletes soft-deleted rows past the 7-day grace period", async () => {
      const now = Date.now();
      const pastGraceDate = new Date(now - 8 * 24 * 60 * 60 * 1000); // 8 days ago

      const expiredAssetId = uuidv7();
      await db.insert(schema.assets).values({
        id: expiredAssetId,
        ownerId: userA.id,
        bucketKey: `users/${userA.id}/test/expired.webp`,
        mime: "image/webp",
        bytes: 100000,
        scanStatus: "clean",
        deletedAt: pastGraceDate,
      });

      // Run reaper
      const deletedFromStorage = recordStorageDeletes();
      // biome-ignore lint/suspicious/noExplicitAny: polymorphic db client
      const reapResult = await reapOrphanedAssets(db as any, {
        gracePeriodMs: 7 * 24 * 60 * 60 * 1000,
      });

      expect(reapResult.hardDeletedCount).toBeGreaterThanOrEqual(1);
      expect(deletedFromStorage).toContain(`users/${userA.id}/test/expired.webp`);

      // Verify row was permanently purged
      const [expiredCheck] = await db
        .select()
        .from(schema.assets)
        .where(eq(schema.assets.id, expiredAssetId));
      expect(expiredCheck).toBeUndefined();
    });
  });
});
