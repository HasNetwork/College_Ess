import type { OutboxEntry } from "@clg-ess/core";
import { schema, uuidv7 } from "@clg-ess/db";
import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { type TestUser, api, failStatementsContaining, seedTwoColleges, testDb } from "./harness";

// Boundary rewrite of the deleted packages/db/tests/sync-integration.test.ts, which never
// imported the route it claimed to cover and re-implemented its filters inline (R17).
// Every assertion here goes through GET/POST /api/sync with a real session.
//
// LWW and the route's authorization rules are covered in sync-authz.test.ts (0.5-2).

function wearEntry(
  owner: TestUser,
  eventId: string,
  garmentId: string,
  wornOn: string,
): OutboxEntry {
  return {
    id: uuidv7(),
    createdAt: Date.now(),
    ownerId: owner.id,
    table: "wear_event",
    op: "insert",
    rowId: eventId,
    payload: { id: eventId, garmentId, wornOn, loggedAt: wornOn },
    attempts: 0,
    status: "pending",
  };
}

const ids = (rows: Array<{ id: string }>) => rows.map((row) => row.id);

describe("/api/sync at the boundary", () => {
  let studentA: TestUser;
  let studentB: TestUser;
  let collegeA: schema.College;
  let collegeB: schema.College;

  beforeAll(async () => {
    ({ studentA, studentB, collegeA, collegeB } = await seedTwoColleges());
  });

  it("keeps both wear events when two offline devices each log one (append-only, R2)", async () => {
    // The same garment worn twice, logged on two devices. A mutable counter synced LWW
    // would resolve to one wear; the append-only log must keep both.
    const garmentId = uuidv7();
    const phone = wearEntry(studentA, uuidv7(), garmentId, "2026-09-21T08:00:00.000Z");
    const laptop = wearEntry(studentA, uuidv7(), garmentId, "2026-09-21T09:00:00.000Z");

    // Each device replays its own outbox independently on reconnect.
    const fromPhone = await api.post("/api/sync", { entries: [phone] }, { as: studentA });
    const fromLaptop = await api.post("/api/sync", { entries: [laptop] }, { as: studentA });
    expect(fromPhone.status).toBe(200);
    expect(fromPhone.body.applied).toEqual([phone.id]);
    expect(fromLaptop.body.applied).toEqual([laptop.id]);

    const pull = await api.get("/api/sync?tables=wear_event", { as: studentA });
    const worn = pull.body.data.wear_event.filter(
      (row: { garmentId: string }) => row.garmentId === garmentId,
    );
    expect(ids(worn).sort()).toEqual([phone.rowId, laptop.rowId].sort());
  });

  it("serves a soft-deleted row as a tombstone, never as live data", async () => {
    const liveId = uuidv7();
    const deletedId = uuidv7();
    await testDb()
      .insert(schema.items)
      .values([
        { id: liveId, collegeId: collegeA.id, userId: studentA.id, kind: "todo", title: "Live" },
        {
          id: deletedId,
          collegeId: collegeA.id,
          userId: studentA.id,
          kind: "todo",
          title: "Deleted on another device",
          deletedAt: new Date(),
        },
      ]);

    const pull = await api.get("/api/sync?tables=item", { as: studentA });
    expect(pull.status).toBe(200);
    expect(ids(pull.body.data.item)).toContain(liveId);
    expect(ids(pull.body.data.item)).not.toContain(deletedId);
    // Without the tombstone an offline cache would keep showing the deleted todo forever.
    expect(ids(pull.body.tombstones.item)).toContain(deletedId);
  });

  it("sends only what changed since the watermark, plus the last minute before it", async () => {
    // Everything, every time, would make each pull as heavy as the first. The minute
    // before `since` is re-sent because a write can commit after a pull read past it.
    const since = new Date();
    const stamped = (msBefore: number) => new Date(since.getTime() - msBefore);
    const unchangedId = uuidv7();
    const lateId = uuidv7();
    await testDb()
      .insert(schema.items)
      .values([
        {
          id: unchangedId,
          collegeId: collegeA.id,
          userId: studentA.id,
          kind: "todo",
          title: "Unchanged for two hours",
          createdAt: stamped(2 * 60 * 60 * 1000),
          updatedAt: stamped(2 * 60 * 60 * 1000),
        },
        {
          id: lateId,
          collegeId: collegeA.id,
          userId: studentA.id,
          kind: "todo",
          title: "Committed just after a pull read",
          createdAt: stamped(2_000),
          updatedAt: stamped(2_000),
        },
      ]);

    const pull = await api.get(`/api/sync?tables=item&since=${since.toISOString()}`, {
      as: studentA,
    });

    expect(ids(pull.body.data.item)).toContain(lateId);
    expect(ids(pull.body.data.item)).not.toContain(unchangedId);
  });

  it("never serves another college's items, in either direction (R4)", async () => {
    const itemA = uuidv7();
    const itemB = uuidv7();
    await testDb()
      .insert(schema.items)
      .values([
        { id: itemA, collegeId: collegeA.id, userId: studentA.id, kind: "event", title: "A only" },
        { id: itemB, collegeId: collegeB.id, userId: studentB.id, kind: "event", title: "B only" },
      ]);

    // Asserting what each student *does* see keeps an empty response from passing vacuously.
    const asA = ids((await api.get("/api/sync?tables=item", { as: studentA })).body.data.item);
    const asB = ids((await api.get("/api/sync?tables=item", { as: studentB })).body.data.item);
    expect(asA).toContain(itemA);
    expect(asA).not.toContain(itemB);
    expect(asB).toContain(itemB);
    expect(asB).not.toContain(itemA);
  });

  it("stops at a server fault: a later change is not attempted, so it never lands first", async () => {
    // Replaying [insert, fault, next], the server must not apply `next` and leave the
    // faulted change to be retried after it: an edit could then land before its insert.
    failStatementsContaining("Lost connection");
    const item = (title: string): OutboxEntry => ({
      id: uuidv7(),
      createdAt: Date.now(),
      ownerId: studentA.id,
      table: "item",
      op: "insert",
      rowId: uuidv7(),
      payload: { kind: "todo", title },
      attempts: 0,
      status: "pending",
    });
    const [first, faulted, next] = [item("First"), item("Lost connection"), item("Next")];

    const res = await api.post("/api/sync", { entries: [first, faulted, next] }, { as: studentA });

    expect(res.body.applied).toEqual([first.id]);
    expect(res.body.rejected).toEqual([expect.objectContaining({ id: faulted.id, code: 500 })]);
    const nextRow = await testDb()
      .select()
      .from(schema.items)
      .where(eq(schema.items.id, next.rowId));
    expect(nextRow).toEqual([]);
  });

  it("refuses bad data for good (400), so the phone stops retrying it", async () => {
    // A retry cannot fix a value the database rejects; a 5xx here would hold every later
    // change behind it through ten backed-off attempts.
    const badKind: OutboxEntry = {
      id: uuidv7(),
      createdAt: Date.now(),
      ownerId: studentA.id,
      table: "item",
      op: "insert",
      rowId: uuidv7(),
      payload: { kind: "not_a_kind", title: "x" },
      attempts: 0,
      status: "pending",
    };
    const badDate: OutboxEntry = {
      ...badKind,
      id: uuidv7(),
      rowId: uuidv7(),
      payload: { kind: "todo", title: "y", startsAt: "next tuesday" },
    };

    const res = await api.post("/api/sync", { entries: [badKind, badDate] }, { as: studentA });

    expect(res.body.rejected.map((r: { code: number }) => r.code)).toEqual([400, 400]);
  });

  it("gives a device back from a long absence everything, marked full, so it replaces its copy", async () => {
    // The reaper deletes an asset row for good a week after it is soft-deleted, and that
    // leaves no tombstone: a merge would keep the row on the device forever.
    const oldId = uuidv7();
    const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
    await testDb().insert(schema.items).values({
      id: oldId,
      collegeId: collegeA.id,
      userId: studentA.id,
      kind: "todo",
      title: "Untouched for ten days",
      createdAt: tenDaysAgo,
      updatedAt: tenDaysAgo,
    });
    const since = (daysAgo: number) =>
      new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString();

    const recent = await api.get(`/api/sync?tables=item&since=${since(1)}`, { as: studentA });
    const long = await api.get(`/api/sync?tables=item&since=${since(8)}`, { as: studentA });

    expect(recent.body.full).toBe(false);
    expect(ids(recent.body.data.item)).not.toContain(oldId);
    expect(long.body.full).toBe(true);
    expect(ids(long.body.data.item)).toContain(oldId);
  });

  it("never serves or accepts grants: authority is not cached client-side (0-5 §6)", async () => {
    const grantId = uuidv7();
    await testDb().insert(schema.grants).values({
      id: grantId,
      userId: studentA.id,
      permission: "manage:club",
      scopeType: "college",
      scopeId: collegeA.id,
    });

    const everything = await api.get("/api/sync", { as: studentA });
    expect(everything.status).toBe(200);
    expect(Object.keys(everything.body.data)).not.toContain("grant");
    expect(JSON.stringify(everything.body)).not.toContain(grantId);

    const askedFor = await api.get("/api/sync?tables=grant", { as: studentA });
    expect(Object.keys(askedFor.body.data)).not.toContain("grant");

    // A client forging a grant for itself through the outbox is rejected and writes nothing.
    const forgedId = uuidv7();
    const forged = await api.post(
      "/api/sync",
      {
        entries: [
          {
            id: uuidv7(),
            createdAt: Date.now(),
            ownerId: studentA.id,
            table: "grant",
            op: "insert",
            rowId: forgedId,
            payload: { permission: "manage:college", scopeType: "college", scopeId: collegeA.id },
            attempts: 0,
            status: "pending",
          },
        ],
      },
      { as: studentA },
    );
    expect(forged.body.applied).toEqual([]);
    expect(forged.body.rejected).toEqual([expect.objectContaining({ code: 403 })]);
    const written = await testDb()
      .select()
      .from(schema.grants)
      .where(eq(schema.grants.id, forgedId));
    expect(written).toEqual([]);
  });
});
