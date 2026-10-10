import { DeleteObjectCommand, HeadObjectCommand, NotFound, S3Client } from "@aws-sdk/client-s3";
import { requireEnv, schema, uuidv7 } from "@clg-ess/db";
import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { USER_STORAGE_QUOTA_BYTES } from "../src/lib/assets/validation";
import { type TestUser, api, createUser, seedTwoColleges, testDb } from "./harness";

// Boundary rewrite of the asset denial tests, which compared `ownerId` to a user id inside
// the test body and never called a route (R17). Everything here is a real request.

async function insertPendingAsset(owner: TestUser) {
  const id = uuidv7();
  const bucketKey = `users/${owner.id}/garment_photo/${id}.webp`;
  await testDb()
    .insert(schema.assets)
    .values({ id, ownerId: owner.id, bucketKey, mime: "image/webp", bytes: 1024 });
  return { id, bucketKey };
}

async function assetRow(id: string) {
  const [row] = await testDb().select().from(schema.assets).where(eq(schema.assets.id, id));
  return row;
}

/**
 * Stubs the storage edge. HEAD answers as `head` says: a number is the size of the stored
 * object in bytes; "no-size" is an answer that omits it. Every command sent is recorded.
 */
function stubStorage(head: number | "missing" | "no-size" | Error) {
  const sent: unknown[] = [];
  vi.spyOn(S3Client.prototype, "send").mockImplementation(async (command: unknown) => {
    sent.push(command);
    if (command instanceof HeadObjectCommand) {
      if (typeof head === "number") return { ContentLength: head };
      if (head === "no-size") return {};
      throw head === "missing"
        ? new NotFound({ message: "Not Found", $metadata: { httpStatusCode: 404 } })
        : head;
    }
    return {};
  });
  return sent;
}

const deletedKeys = (sent: unknown[]) =>
  sent
    .filter((command) => command instanceof DeleteObjectCommand)
    .map((command) => (command as DeleteObjectCommand).input.Key);

/**
 * A URL handed to the browser must reach the configured bucket, be signed for its region
 * (B2 rejects a signature scoped to any other; R2's was "auto"), and pin no checksum: the
 * SDK's default signs the CRC32 of an empty body into a presigned PUT, which every real
 * upload then fails. Holds for virtual-hosted and path-style URLs alike.
 */
function expectStorageUrl(raw: string, key: string) {
  const url = new URL(raw);
  expect(url.hostname.endsWith(new URL(requireEnv("S3_ENDPOINT")).hostname)).toBe(true);
  expect(`${url.hostname}${url.pathname}`).toContain(requireEnv("S3_BUCKET"));
  expect(url.pathname.endsWith(`/${key}`)).toBe(true);
  expect(url.searchParams.get("X-Amz-Credential")).toContain(
    `/${requireEnv("S3_REGION")}/s3/aws4_request`,
  );
  expect([...url.searchParams.keys()].filter((name) => /checksum/i.test(name))).toEqual([]);
}

describe("asset routes", () => {
  let owner: TestUser;
  let other: TestUser;

  beforeAll(async () => {
    ({ studentA: owner, studentB: other } = await seedTwoColleges());
  });

  it("presigns an upload, confirms it with a HEAD and serves it, all from the configured bucket", async () => {
    const sent = stubStorage(200 * 1024);

    const presign = await api.post<{ assetId: string; bucketKey: string; uploadUrl: string }>(
      "/api/assets/presign",
      { mime: "image/webp", bytes: 200 * 1024, purpose: "garment_photo" },
      { as: owner },
    );
    expect(presign.status).toBe(200);
    const { assetId, bucketKey, uploadUrl } = presign.body;
    expectStorageUrl(uploadUrl, bucketKey);
    // The declared size is signed into the URL, so storage refuses a PUT of any other size,
    // including one sent after `complete` has checked the first (0.5-3 §3).
    expect(new URL(uploadUrl).searchParams.get("X-Amz-SignedHeaders")?.split(";")).toContain(
      "content-length",
    );

    const complete = await api.post(`/api/assets/${assetId}/complete`, {}, { as: owner });
    expect(complete.status).toBe(200);
    // `complete` trusts only a HEAD of that exact object in the configured bucket.
    const heads = sent.filter((command) => command instanceof HeadObjectCommand);
    expect(heads.map((head) => (head as HeadObjectCommand).input)).toEqual([
      { Bucket: requireEnv("S3_BUCKET"), Key: bucketKey },
    ]);
    expect((await assetRow(assetId))?.scanStatus).toBe("clean");

    const view = await api.get<{ viewUrl: string }>(`/api/assets/${assetId}`, { as: owner });
    expect(view.status).toBe(200);
    expectStorageUrl(view.body.viewUrl, bucketKey);
  });

  it("refuses to let another user view, complete or delete a private asset", async () => {
    stubStorage(1024);
    const asset = await insertPendingAsset(owner);

    expect((await api.get(`/api/assets/${asset.id}`, { as: other })).status).toBe(403);
    expect((await api.post(`/api/assets/${asset.id}/complete`, {}, { as: other })).status).toBe(
      403,
    );
    expect((await api.delete(`/api/assets/${asset.id}`, { as: other })).status).toBe(403);
    // The refused calls changed nothing.
    expect((await assetRow(asset.id))?.scanStatus).toBe("pending");
    expect((await assetRow(asset.id))?.deletedAt).toBeNull();

    // The owner can do all three, so the 403s above are real denials, not a broken route.
    expect((await api.get(`/api/assets/${asset.id}`, { as: owner })).status).toBe(200);
    expect((await api.post(`/api/assets/${asset.id}/complete`, {}, { as: owner })).status).toBe(
      200,
    );
    expect((await api.delete(`/api/assets/${asset.id}`, { as: owner })).status).toBe(200);
    expect((await assetRow(asset.id))?.deletedAt).not.toBeNull();
  });

  it("refuses to complete an upload whose object is not in storage", async () => {
    // Before 0.5-1 the existence check returned true whenever R2 credentials were absent,
    // so any row could be marked uploaded without an object behind it.
    const sent = stubStorage("missing");
    const asset = await insertPendingAsset(owner);

    const res = await api.post(`/api/assets/${asset.id}/complete`, {}, { as: owner });

    expect(res.status).toBe(400);
    expect((await assetRow(asset.id))?.scanStatus).toBe("pending");
    const heads = sent.filter((command) => command instanceof HeadObjectCommand);
    expect(heads.map((head) => (head as HeadObjectCommand).input.Key)).toEqual([asset.bucketKey]);
  });

  it("completes the upload once the object exists in storage", async () => {
    stubStorage(1024);
    const asset = await insertPendingAsset(owner);

    const res = await api.post(`/api/assets/${asset.id}/complete`, { width: 800 }, { as: owner });

    expect(res.status).toBe(200);
    expect((await assetRow(asset.id))?.scanStatus).toBe("clean");
  });

  it("refuses an upload bigger than it declared, and removes it from storage", async () => {
    // The browser uploads straight to storage, so the size declared at presign is only a
    // claim. Trusted, it would let anyone declare 1 KB, upload 12 MB, and pass both the
    // per-user quota and the bucket's free 10 GB that every student shares.
    const sent = stubStorage(12 * 1024 * 1024);
    const asset = await insertPendingAsset(owner); // declared 1024 bytes

    const res = await api.post(`/api/assets/${asset.id}/complete`, {}, { as: owner });

    expect(res.status).toBe(400);
    expect(deletedKeys(sent)).toEqual([asset.bucketKey]);
    const row = await assetRow(asset.id);
    expect(row?.scanStatus).toBe("pending");
    expect(row?.deletedAt).not.toBeNull();
  });

  it("fails closed when storage answers without the object's size", async () => {
    // Reading a missing size as 0 would accept any upload and record it as free.
    stubStorage("no-size");
    vi.spyOn(console, "error").mockImplementation(() => {});
    const asset = await insertPendingAsset(owner);

    const res = await api.post(`/api/assets/${asset.id}/complete`, {}, { as: owner });

    expect(res.status).toBe(500);
    expect((await assetRow(asset.id))?.scanStatus).toBe("pending");
  });

  it("records the size storage holds, not the size the client declared", async () => {
    // The quota sums these rows, so they must describe what is actually stored.
    stubStorage(700);
    const asset = await insertPendingAsset(owner); // declared 1024 bytes

    const res = await api.post(`/api/assets/${asset.id}/complete`, {}, { as: owner });

    expect(res.status).toBe(200);
    expect((await assetRow(asset.id))?.bytes).toBe(700);
  });

  it("does not record thumbnail details sent by the client", async () => {
    // Thumbnails wait for their first screen, Drip's grid (0.5-3 §3). Until the server makes
    // them, a client-supplied variant is an unchecked storage key, possibly someone else's.
    stubStorage(1024);
    const asset = await insertPendingAsset(owner);
    const variants = { thumb: { key: `users/${other.id}/profile_photo/${uuidv7()}.webp` } };

    const res = await api.post(`/api/assets/${asset.id}/complete`, { variants }, { as: owner });

    expect(res.status).toBe(200);
    expect((await assetRow(asset.id))?.variants).toBeNull();
  });

  it("refuses an upload that would pass your storage quota", async () => {
    // A user of their own, so other tests' assets don't count against the quota here.
    const uploader = await createUser(null, "Uploader");
    await testDb()
      .insert(schema.assets)
      .values({
        ownerId: uploader.id,
        bucketKey: `users/${uploader.id}/attachment/${uuidv7()}.pdf`,
        mime: "application/pdf",
        bytes: USER_STORAGE_QUOTA_BYTES - 1024 * 1024, // 1 MB left
        scanStatus: "clean",
      });
    const presign = (bytes: number) =>
      api.post(
        "/api/assets/presign",
        { mime: "image/webp", bytes, purpose: "garment_photo" },
        { as: uploader },
      );

    const tooBig = await presign(2 * 1024 * 1024);
    const fits = await presign(512 * 1024);

    expect(tooBig.status).toBe(403);
    expect(fits.status).toBe(200);
    // Only the upload that fitted created a row.
    const rows = await testDb()
      .select()
      .from(schema.assets)
      .where(eq(schema.assets.ownerId, uploader.id));
    expect(rows).toHaveLength(2);
  });

  it("does not report a storage failure as a missing object", async () => {
    // "Could not check" must never become an answer: a credentials error is a 500, not a
    // confident 400 "not found" that the client would act on.
    const denied = Object.assign(new Error("Access Denied"), {
      $metadata: { httpStatusCode: 403 },
    });
    stubStorage(denied);
    vi.spyOn(console, "error").mockImplementation(() => {});
    const asset = await insertPendingAsset(owner);

    const res = await api.post(`/api/assets/${asset.id}/complete`, {}, { as: owner });

    expect(res.status).toBe(500);
    expect((await assetRow(asset.id))?.scanStatus).toBe("pending");
  });
});
