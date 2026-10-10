import type { OutboxEntry, SyncPushResult } from "@clg-ess/core";
import { schema, uuidv7 } from "@clg-ess/db";
import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import {
  type TestUser,
  api,
  createCollegeAdmin,
  createUser,
  seedTwoColleges,
  testDb,
} from "./harness";

// Authorization of POST/GET /api/sync (PLAN 0.5-2), all through the real route with real
// sessions. Before 0.5-2 the route guessed ownership from `userId ?? ownerId`; for `doc`,
// `link` and `suggestion`, which have neither, the guess came out "allow", and it stripped
// four named columns from every write and stored the rest.
//
// Two answers mean "no": 403 for a row you can see but may not change, and a no-op for a
// row you cannot see (a 403 there would confirm another college's row exists).

type Unowned = Omit<OutboxEntry, "ownerId">;

function entry(
  table: string,
  op: OutboxEntry["op"],
  rowId: string,
  payload: Record<string, unknown> = {},
): Unowned {
  return {
    id: uuidv7(),
    createdAt: Date.now(),
    table,
    op,
    rowId,
    payload,
    attempts: 0,
    status: "pending",
  };
}

/** Replays entries as `as`'s own outbox would: each marked as their change. */
const push = (as: TestUser, ...entries: Unowned[]) =>
  api.post<SyncPushResult>(
    "/api/sync",
    { entries: entries.map((e) => ({ ...e, ownerId: as.id })) },
    { as },
  );

const rejectedWith = (res: { body: SyncPushResult }, e: Unowned) =>
  res.body.rejected.find((r) => r.id === e.id)?.code;

const ids = (rows: Array<{ id: string }> = []) => rows.map((r) => r.id);

async function itemRow(id: string) {
  return (await testDb().select().from(schema.items).where(eq(schema.items.id, id)))[0];
}
async function linkRow(id: string) {
  return (await testDb().select().from(schema.links).where(eq(schema.links.id, id)))[0];
}
async function docRow(id: string) {
  return (await testDb().select().from(schema.docs).where(eq(schema.docs.id, id)))[0];
}
async function assetRow(id: string) {
  return (await testDb().select().from(schema.assets).where(eq(schema.assets.id, id)))[0];
}
async function suggestionRow(id: string) {
  return (await testDb().select().from(schema.suggestions).where(eq(schema.suggestions.id, id)))[0];
}

async function insertLink(owner: TestUser) {
  const id = uuidv7();
  await testDb().insert(schema.links).values({
    id,
    userId: owner.id,
    fromType: "item",
    fromId: uuidv7(),
    toType: "item",
    toId: uuidv7(),
    relation: "prepares_for",
  });
  return id;
}

describe("/api/sync authorization", () => {
  let studentA: TestUser;
  let studentB: TestUser;
  let classmate: TestUser; // a second student in college A
  let adminA: TestUser;
  let adminB: TestUser;
  let collegeA: schema.College;
  let collegeB: schema.College;

  beforeAll(async () => {
    ({ studentA, studentB, collegeA, collegeB } = await seedTwoColleges());
    classmate = await createUser(collegeA.id, "Classmate");
    adminA = await createCollegeAdmin(collegeA);
    adminB = await createCollegeAdmin(collegeB);
  });

  describe("the guide", () => {
    it("cannot be rewritten or deleted through sync, even by a college admin (403)", async () => {
      // An edit must also write a doc_revision so it can be rolled back (PLAN §2.6), and
      // sync cannot. Before 0.5-2 any student could rewrite the platform guide here.
      const docId = uuidv7();
      await testDb()
        .insert(schema.docs)
        .values({ id: docId, collegeId: null, slug: `faq-${docId}`, title: "FAQ", bodyMd: "ok" });

      for (const caller of [studentA, adminA]) {
        const edit = entry("doc", "update", docId, { title: "pwned", bodyMd: "<script>" });
        const remove = entry("doc", "delete", docId);
        const res = await push(caller, edit, remove);
        expect(rejectedWith(res, edit)).toBe(403);
        expect(rejectedWith(res, remove)).toBe(403);
      }
      expect((await docRow(docId))?.title).toBe("FAQ");
      expect((await docRow(docId))?.deletedAt).toBeNull();
    });

    it("is not in the sync pull, published or not: /api/compass is its only read path", async () => {
      const draft = uuidv7();
      const handbook = uuidv7();
      await testDb()
        .insert(schema.docs)
        .values([
          { id: draft, slug: `draft-${draft}`, title: "Draft", bodyMd: "wip", published: false },
          {
            id: handbook,
            slug: `handbook-${handbook}`,
            title: "Handbook",
            bodyMd: "co-admins",
            minRole: "co_admin",
          },
        ]);

      const everything = await api.get("/api/sync", { as: studentA });
      const askedFor = await api.get("/api/sync?tables=doc", { as: studentA });

      expect(everything.status).toBe(200);
      expect(Object.keys(everything.body.data)).not.toContain("doc");
      expect(JSON.stringify(everything.body)).not.toContain(draft);
      expect(JSON.stringify(everything.body)).not.toContain(handbook);
      expect(Object.keys(askedFor.body.data)).not.toContain("doc");
    });
  });

  describe("links", () => {
    it("serves only your own links", async () => {
      const mine = await insertLink(studentA);
      const classmates = await insertLink(classmate);
      const otherCollege = await insertLink(studentB);

      const pulled = ids((await api.get("/api/sync?tables=link", { as: studentA })).body.data.link);

      expect(pulled).toContain(mine);
      expect(pulled).not.toContain(classmates);
      expect(pulled).not.toContain(otherCollege);
    });

    it("cannot change or delete someone else's link, or be created in their name", async () => {
      const theirs = await insertLink(classmate);
      const forgedId = uuidv7();

      await push(
        studentA,
        entry("link", "update", theirs, { relation: "blocks" }),
        entry("link", "delete", theirs),
        entry("link", "insert", forgedId, {
          userId: classmate.id,
          fromType: "item",
          fromId: uuidv7(),
          toType: "item",
          toId: uuidv7(),
          relation: "blocks",
        }),
      );

      expect((await linkRow(theirs))?.relation).toBe("prepares_for");
      expect((await linkRow(theirs))?.deletedAt).toBeNull();
      expect((await linkRow(forgedId))?.userId).toBe(studentA.id);
    });
  });

  describe("college-wide items", () => {
    async function insertCollegeExam(collegeId: string) {
      const id = uuidv7();
      await testDb()
        .insert(schema.items)
        .values({ id, collegeId, userId: null, kind: "exam", title: "Physics", source: "college" });
      return id;
    }

    it("cannot be edited or deleted by a student (403)", async () => {
      const exam = await insertCollegeExam(collegeA.id);
      const edit = entry("item", "update", exam, { title: "Cancelled!" });
      const remove = entry("item", "delete", exam);

      const res = await push(studentA, edit, remove);

      expect(rejectedWith(res, edit)).toBe(403);
      expect(rejectedWith(res, remove)).toBe(403);
      expect((await itemRow(exam))?.title).toBe("Physics");
      expect((await itemRow(exam))?.deletedAt).toBeNull();
    });

    it("can be edited and deleted by that college's admin, and by no other college's", async () => {
      const exam = await insertCollegeExam(collegeA.id);

      // Invisible, not forbidden: a 403 would confirm the other college's row exists.
      const fromB = entry("item", "update", exam, { title: "From another college" });
      expect(rejectedWith(await push(adminB, fromB), fromB)).toBeUndefined();
      expect((await itemRow(exam))?.title).toBe("Physics");

      const edit = entry("item", "update", exam, { title: "Physics (moved to Hall 2)" });
      const edited = await push(adminA, edit);
      expect(edited.body.applied).toEqual([edit.id]);
      expect((await itemRow(exam))?.title).toBe("Physics (moved to Hall 2)");

      await push(adminA, entry("item", "delete", exam));
      expect((await itemRow(exam))?.deletedAt).not.toBeNull();
    });

    it("cannot be created through sync: an insert is always your own item", async () => {
      const id = uuidv7();
      await push(
        studentA,
        entry("item", "insert", id, {
          kind: "exam",
          title: "Fake exam",
          userId: null,
          collegeId: collegeB.id,
          source: "college",
        }),
      );

      const row = await itemRow(id);
      expect(row?.userId).toBe(studentA.id);
      expect(row?.collegeId).toBe(collegeA.id);
      expect(row?.source).toBe("user");
    });
  });

  describe("suggestions", () => {
    it("are filed as yourself, pending, whatever the payload claims", async () => {
      const id = uuidv7();
      await push(
        studentA,
        entry("suggestion", "insert", id, {
          targetType: "college_info",
          proposedDiff: { libraryHours: "24/7" },
          submittedBy: classmate.id,
          collegeId: collegeB.id,
          status: "approved",
          reviewedBy: classmate.id,
          reviewNote: "self-approved",
        }),
      );

      const row = await suggestionRow(id);
      expect(row?.submittedBy).toBe(studentA.id);
      expect(row?.collegeId).toBe(collegeA.id);
      expect(row?.status).toBe("pending");
      expect(row?.reviewedBy).toBeNull();
      expect(row?.reviewNote).toBeNull();
    });

    it("can be approved by the college admin only, and are locked once reviewed", async () => {
      const id = uuidv7();
      await push(
        studentA,
        entry("suggestion", "insert", id, {
          targetType: "college_info",
          proposedDiff: { canteen: "open till 10" },
        }),
      );

      await push(studentA, entry("suggestion", "update", id, { status: "approved" }));
      expect((await suggestionRow(id))?.status).toBe("pending");

      // The queue is the admin's to see; a classmate sees only their own suggestions.
      const classmateSees = await api.get("/api/sync?tables=suggestion", { as: classmate });
      const adminSees = await api.get("/api/sync?tables=suggestion", { as: adminA });
      expect(ids(classmateSees.body.data.suggestion)).not.toContain(id);
      expect(ids(adminSees.body.data.suggestion)).toContain(id);

      await push(
        adminA,
        entry("suggestion", "update", id, { status: "approved", reviewNote: "ok" }),
      );
      const approved = await suggestionRow(id);
      expect(approved?.status).toBe("approved");
      expect(approved?.reviewedBy).toBe(adminA.id);

      // Editing after approval would change what was approved.
      const rewrite = entry("suggestion", "update", id, { proposedDiff: { canteen: "free food" } });
      expect(rejectedWith(await push(studentA, rewrite), rewrite)).toBe(403);
      expect((await suggestionRow(id))?.proposedDiff).toEqual({ canteen: "open till 10" });
    });
  });

  describe("assets", () => {
    it("keep their storage key, size and scan status server-owned", async () => {
      const assetId = uuidv7();
      const ownKey = `users/${studentA.id}/garment_photo/${assetId}.webp`;
      const victimKey = `users/${classmate.id}/garment_photo/${uuidv7()}.webp`;
      await testDb().insert(schema.assets).values({
        id: assetId,
        ownerId: studentA.id,
        bucketKey: ownKey,
        mime: "image/webp",
        bytes: 1024,
      });

      // Repointing the key would let the owner fetch or delete the classmate's photo;
      // shrinking `bytes` would dodge the quota; `clean` would skip /complete.
      await push(
        studentA,
        entry("asset", "update", assetId, {
          bucketKey: victimKey,
          bytes: 1,
          scanStatus: "clean",
          mime: "image/png",
        }),
      );

      const row = await assetRow(assetId);
      expect(row?.bucketKey).toBe(ownKey);
      expect(row?.bytes).toBe(1024);
      expect(row?.scanStatus).toBe("pending");
      expect(row?.mime).toBe("image/webp");
    });

    it("cannot be created through sync, so no row can point at another user's object", async () => {
      const forged = uuidv7();
      const insert = entry("asset", "insert", forged, {
        bucketKey: `users/${classmate.id}/garment_photo/${uuidv7()}.webp`,
        mime: "image/webp",
        bytes: 1024,
      });

      const res = await push(studentA, insert);

      expect(rejectedWith(res, insert)).toBe(403);
      expect(await assetRow(forged)).toBeUndefined();
    });
  });

  it("decides last-write-wins on the server's clock, never the client's", async () => {
    // A client-supplied updatedAt used to be stored on insert and compared on update: a
    // far-future value froze the row, and a slow phone's edits silently lost.
    const id = uuidv7();
    const future = "2099-01-01T00:00:00.000Z";
    await push(
      studentA,
      entry("item", "insert", id, {
        kind: "todo",
        title: "v1",
        updatedAt: future,
        createdAt: future,
      }),
    );
    expect((await itemRow(id))?.updatedAt.getTime()).toBeLessThan(Date.parse(future));

    const slowClock = entry("item", "update", id, {
      title: "v2",
      updatedAt: "2020-01-01T00:00:00.000Z",
    });
    const res = await push(studentA, slowClock);

    expect(res.body.applied).toEqual([slowClock.id]);
    expect((await itemRow(id))?.title).toBe("v2");
  });

  describe("the pull", () => {
    it("serves your college's shared items but never a classmate's own", async () => {
      // The college guard alone would pass both rows below: they are in your college.
      const shared = uuidv7();
      const theirs = uuidv7();
      await testDb()
        .insert(schema.items)
        .values([
          { id: shared, collegeId: collegeA.id, userId: null, kind: "holiday", title: "Diwali" },
          { id: theirs, collegeId: collegeA.id, userId: classmate.id, kind: "todo", title: "Mine" },
        ]);

      const pulled = ids((await api.get("/api/sync?tables=item", { as: studentA })).body.data.item);

      expect(pulled).toContain(shared);
      expect(pulled).not.toContain(theirs);
    });

    it("ignores a college id in the query: the scope is the session's", async () => {
      const own = uuidv7();
      const theirs = uuidv7();
      await testDb()
        .insert(schema.items)
        .values([
          { id: own, collegeId: collegeA.id, userId: studentA.id, kind: "todo", title: "A" },
          { id: theirs, collegeId: collegeB.id, userId: null, kind: "holiday", title: "B day" },
        ]);

      const res = await api.get(
        `/api/sync?tables=item&collegeId=${collegeB.id}&college_id=${collegeB.id}`,
        { as: studentA },
      );

      expect(ids(res.body.data.item)).toContain(own);
      expect(ids(res.body.data.item)).not.toContain(theirs);
    });

    it("serves your college's tombstones and never another college's", async () => {
      const own = uuidv7();
      const theirs = uuidv7();
      const deletedAt = new Date();
      await testDb()
        .insert(schema.items)
        .values([
          { id: own, collegeId: collegeA.id, userId: null, kind: "holiday", title: "A", deletedAt },
          {
            id: theirs,
            collegeId: collegeB.id,
            userId: null,
            kind: "holiday",
            title: "B",
            deletedAt,
          },
        ]);

      const res = await api.get("/api/sync?tables=item", { as: studentA });

      expect(ids(res.body.tombstones.item)).toContain(own);
      expect(ids(res.body.tombstones.item)).not.toContain(theirs);
    });
  });
});
