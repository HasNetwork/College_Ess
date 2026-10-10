import type { OutboxEntry, SyncPullResponse } from "@clg-ess/core";
import { schema, uuidv7 } from "@clg-ess/db";
import { QueryClient } from "@tanstack/react-query";
import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import {
  SYNC_QUERY_KEY,
  type SyncCache,
  type SyncOwner,
  syncQueryOptions,
} from "../src/lib/sync/pull";
import { type TestUser, api, createUser, harnessFetch, seedTwoColleges, testDb } from "./harness";

// The client half of sync (0.5-3 §2): the pull nothing used to call. Each "device" below is
// a QueryClient running the production pull query against the real GET /api/sync.

const device = () => new QueryClient({ defaultOptions: { queries: { retry: false } } });

const ownerOf = (user: TestUser): SyncOwner => ({ userId: user.id, collegeId: user.collegeId });

/** A fetch that runs the real routes as `user` and records every URL it was asked for. */
function recordingFetch(user: TestUser) {
  const urls: string[] = [];
  const inner = harnessFetch(user);
  const fetcher: typeof fetch = (input, init) => {
    urls.push(String(input));
    return inner(input, init);
  };
  return { fetcher, urls };
}

const pull = (client: QueryClient, user: TestUser, fetcher: typeof fetch = harnessFetch(user)) =>
  client.fetchQuery(syncQueryOptions(ownerOf(user), fetcher));

function itemEntry(
  op: OutboxEntry["op"],
  rowId: string,
  title = "Revise optics",
): Omit<OutboxEntry, "ownerId"> {
  return {
    id: uuidv7(),
    createdAt: Date.now(),
    table: "item",
    op,
    rowId,
    payload: op === "insert" ? { kind: "todo", title } : {},
    attempts: 0,
    status: "pending",
  };
}

/** Another device of `user` replaying its outbox through the real route. */
async function writeFromAnotherDevice(user: TestUser, entry: Omit<OutboxEntry, "ownerId">) {
  const res = await api.post(
    "/api/sync",
    { entries: [{ ...entry, ownerId: user.id }] },
    { as: user },
  );
  expect(res.body.applied).toEqual([entry.id]);
}

const titles = (cache: SyncCache) =>
  Object.values(cache.tables.item ?? {}).map((row) => row.title as string);

describe("the sync pull", () => {
  let student: TestUser;
  let classmate: TestUser;

  beforeAll(async () => {
    const { studentA, collegeA } = await seedTwoColleges();
    student = studentA;
    classmate = await createUser(collegeA.id, "Classmate");
  });

  it("brings rows written on another device into this device's cache", async () => {
    const id = uuidv7();
    await writeFromAnotherDevice(student, itemEntry("insert", id, "Buy lab coat"));

    const cache = await pull(device(), student);

    expect(cache.tables.item?.[id]?.title).toBe("Buy lab coat");
  });

  it("removes a row deleted on another device, pulling only what changed since last time", async () => {
    // Without the tombstone, a todo deleted on the laptop stays on the phone forever.
    const id = uuidv7();
    await writeFromAnotherDevice(student, itemEntry("insert", id, "Return library book"));
    // Unchanged for a day, so the second pull does not re-send it: the phone must keep it
    // from the first.
    const keptId = uuidv7();
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    await testDb().insert(schema.items).values({
      id: keptId,
      collegeId: student.collegeId,
      userId: student.id,
      kind: "todo",
      title: "Untouched since yesterday",
      createdAt: dayAgo,
      updatedAt: dayAgo,
    });
    const phone = device();
    const { fetcher, urls } = recordingFetch(student);
    const first = await pull(phone, student, fetcher);
    expect(first.tables.item?.[id]).toBeDefined();

    await writeFromAnotherDevice(student, itemEntry("delete", id));
    const second = await pull(phone, student, fetcher);

    expect(second.tables.item?.[id]).toBeUndefined();
    expect(second.tables.item?.[keptId]?.title).toBe("Untouched since yesterday");
    expect(urls).toEqual(["/api/sync", `/api/sync?since=${encodeURIComponent(first.watermark)}`]);
  });

  it("keeps the server's clock as its watermark, never this device's", async () => {
    // A phone whose clock runs ten minutes fast would otherwise ask for "changes since ten
    // minutes from now" and silently miss everything written in between (0-5 §4).
    const serverTime = "2020-01-01T00:00:00.000Z";
    const urls: string[] = [];
    const server: typeof fetch = async (input) => {
      urls.push(String(input));
      const body: SyncPullResponse = { serverTime, data: {}, tombstones: {}, full: false };
      return Response.json(body);
    };
    const phone = device();

    const cache = await pull(phone, student, server);
    await pull(phone, student, server);

    expect(cache.watermark).toBe(serverTime);
    expect(urls[1]).toBe(`/api/sync?since=${encodeURIComponent(serverTime)}`);
  });

  it("still pulls a write stamped just before the watermark", async () => {
    // A write takes its timestamp, then commits. A pull on another server instance can
    // read between the two, and then hand out a watermark later than the write's stamp.
    const phone = device();
    const { watermark } = await pull(phone, student);
    const id = uuidv7();
    const stamped = new Date(Date.parse(watermark) - 2_000);
    await testDb().insert(schema.items).values({
      id,
      collegeId: student.collegeId,
      userId: student.id,
      kind: "todo",
      title: "Committed late",
      createdAt: stamped,
      updatedAt: stamped,
    });

    const cache = await pull(phone, student);

    expect(cache.tables.item?.[id]?.title).toBe("Committed late");
  });

  it("replaces its copy after a long absence, so a row deleted for good does not linger", async () => {
    // A hard delete (the reaper's, a week after an asset is soft-deleted) leaves no
    // tombstone. Merging would keep the row on this phone forever (0.5-4).
    const phone = device();
    const goneId = uuidv7();
    await writeFromAnotherDevice(student, itemEntry("insert", goneId, "Deleted for good"));
    const cache = await pull(phone, student);
    expect(cache.tables.item?.[goneId]).toBeDefined();
    await testDb().delete(schema.items).where(eq(schema.items.id, goneId));
    const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();
    phone.setQueryData<SyncCache>(SYNC_QUERY_KEY, { ...cache, watermark: eightDaysAgo });

    const after = await pull(phone, student);

    expect(after.tables.item?.[goneId]).toBeUndefined();
  });

  it("starts clean when another account signs in on the same device", async () => {
    // A shared phone: the next student must not see, or build on, the last one's rows.
    const id = uuidv7();
    await writeFromAnotherDevice(student, itemEntry("insert", id, "Private to the first"));
    const shared = device();
    await pull(shared, student);
    const { fetcher, urls } = recordingFetch(classmate);

    const cache = await pull(shared, classmate, fetcher);

    expect(cache.owner).toEqual(ownerOf(classmate));
    expect(titles(cache)).not.toContain("Private to the first");
    expect(urls).toEqual(["/api/sync"]);
  });
});
