import { HeadObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { requireEnv, schema, uuidv7 } from "@clg-ess/db";
import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it, vi } from "vitest";
import type { CompressResult } from "../src/lib/assets/compress";
import { replaceProfilePhoto, uploadPhoto } from "../src/lib/assets/upload";
import { USER_STORAGE_QUOTA_BYTES } from "../src/lib/assets/validation";
import { type TestUser, api, createUser, harnessFetch, seedTwoColleges, testDb } from "./harness";

// The browser side of an upload (0.5-3 §3) against the real presign, complete and delete
// routes. Only the far side of storage is stubbed: the PUT the browser sends straight to the
// bucket, and the HEAD the server sends to check it. Compression needs a canvas, so it is
// stubbed here and runs for real in e2e/profile-photo.spec.ts.

const PHOTO_BYTES = 48 * 1024;

/** What compressImage hands back for a phone photo: a small WebP. */
async function compressed(): Promise<CompressResult> {
  const blob = new Blob([new Uint8Array(PHOTO_BYTES)], { type: "image/webp" });
  return { blob, width: 512, height: 384, mime: "image/webp", bytes: blob.size };
}

const cameraPhoto = () => new Blob([new Uint8Array(1024)], { type: "image/jpeg" });

/** Storage as the server sees it: HEAD finds the object at `storedBytes`. */
function storageHolds(storedBytes: number) {
  vi.spyOn(S3Client.prototype, "send").mockImplementation(async (command: unknown) =>
    command instanceof HeadObjectCommand ? { ContentLength: storedBytes } : {},
  );
}

/** The browser's PUT to the bucket: answers `status`, or fails like a refusal with no CORS. */
function bucketAnswers(status: number | "network-error") {
  const puts: Array<{ url: string; type: string | null; size: number }> = [];
  const external = async (outgoing: Request) => {
    puts.push({
      url: outgoing.url,
      type: outgoing.headers.get("content-type"),
      size: (await outgoing.arrayBuffer()).byteLength,
    });
    if (status === "network-error") throw new TypeError("Failed to fetch");
    return new Response(null, { status });
  };
  return { external, puts };
}

async function assetsOf(user: TestUser) {
  return testDb().select().from(schema.assets).where(eq(schema.assets.ownerId, user.id));
}

describe("uploading a photo", () => {
  let student: TestUser;

  beforeAll(async () => {
    ({ studentA: student } = await seedTwoColleges());
  });

  it("shrinks it on the device, sends it straight to storage, and records it", async () => {
    storageHolds(PHOTO_BYTES);
    const bucket = bucketAnswers(200);

    const result = await uploadPhoto(cameraPhoto(), "profile_photo", {
      fetcher: harnessFetch(student, bucket.external),
      compress: compressed,
    });

    expect(result).toEqual({ ok: true, assetId: expect.any(String), bytes: PHOTO_BYTES });
    const [row] = (await assetsOf(student)).filter(
      (asset) => result.ok && asset.id === result.assetId,
    );
    expect(row?.scanStatus).toBe("clean");
    expect(row?.bytes).toBe(PHOTO_BYTES);
    // The compressed photo, not the original, went to the object the server named.
    expect(bucket.puts).toEqual([
      {
        url: expect.stringContaining(row?.bucketKey ?? "?"),
        type: "image/webp",
        size: PHOTO_BYTES,
      },
    ]);
  });

  it("keeps the photo and says storage refused it when the bucket answers 403", async () => {
    // B2 at a free limit refuses requests for everyone (PLAN §4.1). The student must learn
    // why, keep the photo to try again, and the half-made upload is left to the reaper.
    const bucket = bucketAnswers(403);
    const photo = cameraPhoto();
    const before = (await assetsOf(student)).length;

    const result = await uploadPhoto(photo, "profile_photo", {
      fetcher: harnessFetch(student, bucket.external),
      compress: compressed,
    });

    expect(result).toEqual({ ok: false, reason: "storage_refused" });
    expect(bucket.puts).toHaveLength(1);
    const pending = (await assetsOf(student)).slice(before);
    expect(pending.map((asset) => asset.scanStatus)).toEqual(["pending"]);
    // Nothing consumed the photo: it can be sent again as it is.
    expect(photo.size).toBe(1024);
  });

  it("reads a refusal that arrives without CORS headers as the same refusal", async () => {
    const bucket = bucketAnswers("network-error");

    const result = await uploadPhoto(cameraPhoto(), "profile_photo", {
      fetcher: harnessFetch(student, bucket.external),
      compress: compressed,
    });

    expect(result).toEqual({ ok: false, reason: "storage_refused" });
  });

  it("says when the account's storage is full, and sends nothing", async () => {
    const full = await createUser(null, "Full");
    await testDb()
      .insert(schema.assets)
      .values({
        ownerId: full.id,
        bucketKey: `users/${full.id}/attachment/${uuidv7()}.pdf`,
        mime: "application/pdf",
        bytes: USER_STORAGE_QUOTA_BYTES - 1024,
        scanStatus: "clean",
      });
    const bucket = bucketAnswers(200);

    const result = await uploadPhoto(cameraPhoto(), "profile_photo", {
      fetcher: harnessFetch(full, bucket.external),
      compress: compressed,
    });

    expect(result).toEqual({ ok: false, reason: "quota" });
    expect(bucket.puts).toEqual([]);
  });

  it("never sends a file the device cannot read as an image", async () => {
    const calls: string[] = [];
    const fetcher: typeof fetch = async (input) => {
      calls.push(String(input));
      throw new Error("no request expected");
    };

    const result = await uploadPhoto(new Blob(["not a photo"]), "profile_photo", {
      fetcher,
      compress: async () => {
        throw new Error("The source image could not be decoded.");
      },
    });

    expect(result).toEqual({ ok: false, reason: "not_an_image" });
    expect(calls).toEqual([]);
  });

  it("frees the new photo when the profile can't be pointed at it, and keeps the old one", async () => {
    // Nothing would point at the upload, and a completed upload is never reaped: it would
    // count against the quota forever, and every retry would add another.
    storageHolds(PHOTO_BYTES);
    const current = await uploadPhoto(cameraPhoto(), "profile_photo", {
      fetcher: harnessFetch(student, bucketAnswers(200).external),
      compress: compressed,
    });
    if (!current.ok) throw new Error(`setup upload failed: ${current.reason}`);
    const before = new Set((await assetsOf(student)).map((asset) => asset.id));

    const attempt = replaceProfilePhoto(cameraPhoto(), {
      previous: current.assetId,
      setImage: async () => {
        throw new Error("session expired");
      },
      fetcher: harnessFetch(student, bucketAnswers(200).external),
      compress: compressed,
    });

    await expect(attempt).rejects.toThrow("session expired");
    const rows = await assetsOf(student);
    const added = rows.filter((row) => !before.has(row.id));
    expect(added).toHaveLength(1);
    expect(added[0]?.deletedAt).not.toBeNull();
    expect(rows.find((row) => row.id === current.assetId)?.deletedAt).toBeNull();
  });

  it("replacing the profile photo points the profile at it and frees the old one", async () => {
    // A completed upload nothing points at is never reaped, so the old photo would count
    // against the student's quota forever.
    storageHolds(PHOTO_BYTES);
    const fetcher = harnessFetch(student, bucketAnswers(200).external);
    const setImage = async (image: string) => {
      const res = await api.post(
        "/api/auth/update-user",
        { image },
        { as: student, headers: { origin: requireEnv("BETTER_AUTH_URL") } },
      );
      expect(res.status).toBe(200);
    };
    const first = await replaceProfilePhoto(cameraPhoto(), {
      previous: null,
      setImage,
      fetcher,
      compress: compressed,
    });
    if (!first.ok) throw new Error(`first upload failed: ${first.reason}`);

    const second = await replaceProfilePhoto(cameraPhoto(), {
      previous: first.assetId,
      setImage,
      fetcher,
      compress: compressed,
    });

    if (!second.ok) throw new Error(`second upload failed: ${second.reason}`);
    const [user] = await testDb().select().from(schema.user).where(eq(schema.user.id, student.id));
    expect(user?.image).toBe(second.assetId);
    const rows = await assetsOf(student);
    expect(rows.find((row) => row.id === first.assetId)?.deletedAt).not.toBeNull();
    expect(rows.find((row) => row.id === second.assetId)?.deletedAt).toBeNull();
  });
});
