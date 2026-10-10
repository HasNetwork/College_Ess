import "fake-indexeddb/auto";
import { schema, uuidv7 } from "@clg-ess/db";
import { eq } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { getDb } from "../src/lib/sync/db";
import {
  MAX_ATTEMPTS,
  discardUnsent,
  getDeadLetters,
  getPendingWrites,
  getUnsentCount,
  markDeadLetter,
  queueWrite,
  retryDeadLetter,
} from "../src/lib/sync/outbox";
import { DRAIN_BATCH_SIZE, drainOutbox } from "../src/lib/sync/replay";
import {
  type TestUser,
  createUser,
  failStatementsContaining,
  harnessFetch,
  seedTwoColleges,
  testDb,
} from "./harness";

// The outbox (0.5-4 §4, §6) against the real POST /api/sync: queued in IndexedDB (fake, in
// Node) exactly as a phone queues them, replayed through `drainOutbox` with a real session.
// Before 0.5-4 these tests answered with a mocked fetch. No screen queues writes until
// Phase 1-1, so this, and the runner's tests, are what hold the outbox to its word.

async function itemRow(id: string) {
  const [row] = await testDb().select().from(schema.items).where(eq(schema.items.id, id));
  return row;
}

const todo = (title: string) => ({ kind: "todo", title });

/** A fetch that answers every request with `response`, the way something between the phone
 * and the app would: a server fault, a login page. */
const answering =
  (response: () => Response): typeof fetch =>
  async () =>
    response();

const serverFault = () => Response.json({ error: "Internal error" }, { status: 500 });

describe("the outbox, replayed to the real /api/sync", () => {
  let student: TestUser;
  let classmate: TestUser;

  beforeAll(async () => {
    const { studentA, collegeA } = await seedTwoColleges();
    student = studentA;
    classmate = await createUser(collegeA.id, "Classmate");
  });

  beforeEach(async () => {
    await getDb().outbox.clear();
  });

  it("sends queued changes in order and forgets each once applied", async () => {
    const insert = await queueWrite(student.id, "item", "insert", todo("Draft essay"));
    await queueWrite(student.id, "item", "update", { title: "Final essay" }, insert.rowId);

    const result = await drainOutbox(student.id, harnessFetch(student));

    expect(result).toMatchObject({ outcome: "sent", appliedCount: 2 });
    expect(await getPendingWrites(student.id)).toEqual([]);
    // The edit landed after the insert it depends on.
    expect((await itemRow(insert.rowId))?.title).toBe("Final essay");
    expect((await itemRow(insert.rowId))?.userId).toBe(student.id);
  });

  it("never sends one student's queued change while another is signed in", async () => {
    // A shared phone: the first student queued this offline, then the classmate signed in.
    const theirs = await queueWrite(student.id, "item", "insert", todo("Private to the first"));

    const asClassmate = await drainOutbox(classmate.id, harnessFetch(classmate));

    expect(asClassmate.outcome).toBe("idle");
    expect(await itemRow(theirs.rowId)).toBeUndefined();
    const [kept] = await getPendingWrites(student.id);
    expect(kept).toMatchObject({ id: theirs.id, attempts: 0 });

    // Back as its owner, it goes, as theirs.
    await drainOutbox(student.id, harnessFetch(student));
    expect((await itemRow(theirs.rowId))?.userId).toBe(student.id);
  });

  it("is refused by the server if the session changed under the device (409), and kept", async () => {
    // The device still thinks the first student is signed in, but the cookie is now the
    // classmate's: the server must not apply it as the classmate's.
    const queued = await queueWrite(student.id, "item", "insert", todo("Not the classmate's"));

    const result = await drainOutbox(student.id, harnessFetch(classmate));

    expect(result.outcome).toBe("signed_out");
    expect(await itemRow(queued.rowId)).toBeUndefined();
    expect((await getPendingWrites(student.id))[0]).toMatchObject({ id: queued.id, attempts: 0 });
  });

  it("keeps every change on a 401 and asks for sign-in, counting nothing against them", async () => {
    // An expired session is routine on a campus phone. Before 0.5-4 one 401 dead-lettered
    // every change made offline.
    await queueWrite(student.id, "item", "insert", todo("One"));
    await queueWrite(student.id, "item", "insert", todo("Two"));

    const result = await drainOutbox(student.id, harnessFetch(null));

    expect(result.outcome).toBe("signed_out");
    const pending = await getPendingWrites(student.id);
    expect(pending.map((entry) => entry.attempts)).toEqual([0, 0]);
    expect(await getDeadLetters(student.id)).toEqual([]);
  });

  it("dead-letters only the change refused for good; the others still land", async () => {
    const before = await queueWrite(student.id, "item", "insert", todo("Before"));
    const forged = await queueWrite(student.id, "grant", "insert", { permission: "*" });
    const after = await queueWrite(student.id, "item", "insert", todo("After"));

    const result = await drainOutbox(student.id, harnessFetch(student));

    expect(result).toMatchObject({ outcome: "sent", appliedCount: 2, rejectedCount: 1 });
    expect((await itemRow(before.rowId))?.title).toBe("Before");
    expect((await itemRow(after.rowId))?.title).toBe("After");
    const [failed] = await getDeadLetters(student.id);
    expect(failed?.id).toBe(forged.id);
    expect(failed?.lastError).toContain("403");
  });

  it("counts a server fault against the first change only, and gives up visibly at the cap", async () => {
    const first = await queueWrite(student.id, "item", "insert", todo("Stuck"));
    const second = await queueWrite(student.id, "item", "insert", todo("Behind it"));

    const once = await drainOutbox(student.id, answering(serverFault));
    expect(once.outcome).toBe("server_error");
    expect((await getPendingWrites(student.id)).map((entry) => entry.attempts)).toEqual([1, 0]);

    for (let i = 1; i < MAX_ATTEMPTS; i++) {
      await drainOutbox(student.id, answering(serverFault));
    }

    const [gaveUp] = await getDeadLetters(student.id);
    expect(gaveUp?.id).toBe(first.id);
    expect(gaveUp?.lastError).toContain(`Gave up after ${MAX_ATTEMPTS} tries`);
    // The change behind it was not held back forever.
    await drainOutbox(student.id, harnessFetch(student));
    expect((await itemRow(second.rowId))?.title).toBe("Behind it");

    // Retry puts it back with a fresh allowance, not one try from giving up again, and
    // sends it as it was.
    await retryDeadLetter(first.id);
    expect((await getPendingWrites(student.id))[0]).toMatchObject({ id: first.id, attempts: 0 });
    await drainOutbox(student.id, harnessFetch(student));
    expect((await itemRow(first.rowId))?.title).toBe("Stuck");
    expect(await getUnsentCount(student.id)).toBe(0);
  });

  it("keeps a change the database failed on, and everything queued after it, to retry in order", async () => {
    // The route stops at the fault, so the change behind it was never attempted: sending
    // it now would let it land before the one it may depend on.
    const faulted = await queueWrite(student.id, "item", "insert", todo("Lost connection"));
    const behind = await queueWrite(
      student.id,
      "item",
      "update",
      { title: "Edited" },
      faulted.rowId,
    );
    failStatementsContaining("Lost connection");

    const result = await drainOutbox(student.id, harnessFetch(student));

    expect(result.outcome).toBe("server_error");
    const pending = await getPendingWrites(student.id);
    expect(pending.map((entry) => [entry.id, entry.attempts])).toEqual([
      [faulted.id, 1],
      [behind.id, 0],
    ]);
    expect(await getDeadLetters(student.id)).toEqual([]);
  });

  it("treats a page that is not College Ess as unreachable, and counts nothing", async () => {
    // Campus Wi-Fi's login page answers every request with 200 and HTML.
    await queueWrite(student.id, "item", "insert", todo("Waiting for Wi-Fi"));
    const loginPage = answering(
      () =>
        new Response("<html>Sign in to CampusNet</html>", {
          headers: { "content-type": "text/html" },
        }),
    );

    const portal = await drainOutbox(student.id, loginPage);
    const offline = await drainOutbox(student.id, async () => {
      throw new TypeError("Failed to fetch");
    });

    expect(portal.outcome).toBe("unreachable");
    expect(offline.outcome).toBe("unreachable");
    expect((await getPendingWrites(student.id))[0]?.attempts).toBe(0);
  });

  it("sends a long offline queue in bounded batches", async () => {
    const count = DRAIN_BATCH_SIZE * 2 + 5;
    for (let i = 0; i < count; i++) {
      await queueWrite(student.id, "item", "insert", todo(`Offline ${i}`));
    }
    const sizes: number[] = [];
    const inner = harnessFetch(student);
    const counting: typeof fetch = async (input, init) => {
      sizes.push((JSON.parse(String(init?.body)) as { entries: unknown[] }).entries.length);
      return inner(input, init);
    };

    const result = await drainOutbox(student.id, counting);

    expect(result.appliedCount).toBe(count);
    expect(sizes).toEqual([DRAIN_BATCH_SIZE, DRAIN_BATCH_SIZE, 5]);
  });

  it("discards one student's unsent changes at sign-out, and nobody else's", async () => {
    await queueWrite(student.id, "item", "insert", todo("Pending"));
    const failed = await queueWrite(student.id, "grant", "insert", { permission: "*" });
    await markDeadLetter(failed.id, "Rejected with 403: Forbidden");
    await queueWrite(classmate.id, "item", "insert", todo("The classmate's"));
    expect(await getUnsentCount(student.id)).toBe(2);

    await discardUnsent(student.id);

    expect(await getUnsentCount(student.id)).toBe(0);
    expect(await getUnsentCount(classmate.id)).toBe(1);
  });
});

describe("the outbox's owner (0.5-4 §6)", () => {
  it("records whose change each entry is", async () => {
    const owner = uuidv7();
    const entry = await queueWrite(owner, "item", "insert", todo("Mine"));
    expect(entry.ownerId).toBe(owner);
    expect(entry.payload.id).toBe(entry.rowId);
  });
});
