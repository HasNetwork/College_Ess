import { DeleteObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { requireEnv, schema, uuidv7 } from "@clg-ess/db";
import { eq } from "drizzle-orm";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import webpush from "web-push";
import { type TestUser, api, createCollege, createUser, testDb } from "./harness";

// The orphan reaper keeps abandoned and deleted uploads from filling the bucket's free
// 10 GB (PLAN §2.4). It rides the reminder tick, the only minute-level trigger (R1, R7),
// once an hour. Its own file: a pinned clock at minute 0 reaps every stale row in the
// database, so it must not share one with tick-route.test.ts.

const TICK = "/api/internal/tick";
const HOUR = 60 * 60 * 1000;

/** POSTs the tick as the Worker does, with the server's clock pinned to `at`. */
function tickAt(at: string) {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(at));
  return api.post(TICK, undefined, { headers: { "x-tick-secret": requireEnv("TICK_SECRET") } });
}

/** An upload presigned 25 h before `at` and never completed. */
async function insertAbandonedUpload(owner: TestUser, at: string) {
  const id = uuidv7();
  const bucketKey = `users/${owner.id}/profile_photo/${id}.webp`;
  const presignedAt = new Date(Date.parse(at) - 25 * HOUR);
  await testDb().insert(schema.assets).values({
    id,
    ownerId: owner.id,
    bucketKey,
    mime: "image/webp",
    bytes: 1024,
    createdAt: presignedAt,
    updatedAt: presignedAt,
  });
  return { id, bucketKey };
}

async function assetRow(id: string) {
  const [row] = await testDb().select().from(schema.assets).where(eq(schema.assets.id, id));
  return row;
}

/** Stubs the storage edge and records the key of every object deleted. */
function recordStorageDeletes(): string[] {
  const deleted: string[] = [];
  vi.spyOn(S3Client.prototype, "send").mockImplementation(async (command: unknown) => {
    if (command instanceof DeleteObjectCommand) deleted.push(command.input.Key ?? "");
    return {};
  });
  return deleted;
}

/** One mandatory exam reminder due at `at`, and one device to send it to. */
async function seedDueExamReminder(user: TestUser, at: string) {
  const examId = uuidv7();
  await testDb().insert(schema.items).values({
    id: examId,
    collegeId: user.collegeId,
    userId: user.id,
    kind: "exam",
    title: "Exam",
  });
  const due = new Date(Date.parse(at) - 60_000);
  await testDb().insert(schema.reminders).values({
    userId: user.id,
    subjectType: "item",
    subjectId: examId,
    triggerKind: "absolute",
    triggerValue: due.toISOString(),
    channel: "push",
    forced: true,
    enabled: true,
    nextFireAt: due,
  });
  await testDb()
    .insert(schema.pushSubscriptions)
    .values({ userId: user.id, endpoint: `https://push.test/${uuidv7()}`, p256dh: "k", auth: "a" });
}

describe("the orphan reaper, run by the tick", () => {
  let owner: TestUser;

  beforeAll(async () => {
    owner = await createUser((await createCollege("reaper")).id);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("reaps an abandoned upload on the tick at the top of the hour", async () => {
    const at = "2026-09-25T10:00:05Z";
    const upload = await insertAbandonedUpload(owner, at);
    const deleted = recordStorageDeletes();

    const res = await tickAt(at);

    expect(res.status).toBe(200);
    expect(deleted).toEqual([upload.bucketKey]);
    expect((await assetRow(upload.id))?.deletedAt).not.toBeNull();
  });

  it("leaves uploads alone on the other ticks of the hour", async () => {
    // Every minute would be 60 sweeps an hour for work that is never urgent.
    const at = "2026-09-25T10:07:05Z";
    const upload = await insertAbandonedUpload(owner, at);
    const deleted = recordStorageDeletes();

    const res = await tickAt(at);

    expect(res.status).toBe(200);
    expect(deleted).toEqual([]);
    expect((await assetRow(upload.id))?.deletedAt).toBeNull();
  });

  it("fails the tick when storage refuses a delete, after that tick's reminders went out", async () => {
    // A reaper that can't delete must not look healthy (0.5-3 §6), and must never cost a
    // student their exam reminder.
    const at = "2026-09-25T11:00:05Z";
    await insertAbandonedUpload(owner, at);
    await seedDueExamReminder(owner, at);
    const sends = vi
      .spyOn(webpush, "sendNotification")
      .mockResolvedValue({ statusCode: 201, body: "", headers: {} });
    vi.spyOn(S3Client.prototype, "send").mockRejectedValue(
      Object.assign(new Error("Access Denied"), { $metadata: { httpStatusCode: 403 } }),
    );
    vi.spyOn(console, "error").mockImplementation(() => {});

    const res = await tickAt(at);

    expect(res.status).toBe(500);
    expect(sends).toHaveBeenCalledTimes(1);
  });
});
