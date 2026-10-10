import "fake-indexeddb/auto";
import { schema } from "@clg-ess/db";
import { eq } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { getDb } from "../src/lib/sync/db";
import { getPendingWrites, queueWrite } from "../src/lib/sync/outbox";
import { drainOutbox } from "../src/lib/sync/replay";
import { type SyncStatus, createSyncRunner, retryDelay } from "../src/lib/sync/runner";
import { type TestUser, createCollege, createUser, harnessFetch, testDb } from "./harness";

// The sync runner (0.5-4 §4, §5): what the provider uses to send the signed-in account's
// changes, retry them unattended, and decide online or offline from what requests actually
// do. Real drain, real route; only the network between them is made to fail, and the
// timer is replaced by a list the test works through by hand.

/** The network between the phone and the app: down, a campus login page, or through. */
type Network = "down" | "portal" | "fault" | "up";

function device(student: TestUser, initiallyReachable = true) {
  let network: Network = "up";
  const real = harnessFetch(student);
  const fetcher: typeof fetch = async (input, init) => {
    if (network === "down") throw new TypeError("Failed to fetch");
    if (network === "portal") {
      return new Response("<html>Sign in to CampusNet</html>", {
        headers: { "content-type": "text/html" },
      });
    }
    if (network === "fault") return Response.json({ error: "Internal" }, { status: 500 });
    return real(input, init);
  };
  const retries: Array<{ run: () => Promise<void>; delayMs: number; cancelled: boolean }> = [];
  const statuses: SyncStatus[] = [];
  const runner = createSyncRunner({
    drain: (ownerId) => drainOutbox(ownerId, fetcher),
    // The pull's reachability, from the same network.
    refresh: async () => network === "up" || network === "fault",
    schedule: (run, delayMs) => {
      const retry = { run, delayMs, cancelled: false };
      retries.push(retry);
      return () => {
        retry.cancelled = true;
      };
    },
    onStatus: (status) => statuses.push(status),
    initiallyReachable,
  });
  return {
    runner,
    retries,
    status: () => statuses.at(-1),
    setNetwork: (to: Network) => {
      network = to;
    },
    /** Lets the next waiting retry fire, as its timer would, and waits for it to finish. */
    async fireRetry() {
      const next = retries.find((retry) => !retry.cancelled);
      if (!next) throw new Error("no retry is waiting");
      next.cancelled = true;
      await next.run();
    },
    waiting: () => retries.filter((retry) => !retry.cancelled),
  };
}

async function itemRow(id: string) {
  const [row] = await testDb().select().from(schema.items).where(eq(schema.items.id, id));
  return row;
}

describe("the sync runner", () => {
  let student: TestUser;

  beforeAll(async () => {
    student = await createUser((await createCollege("runner")).id);
  });

  beforeEach(async () => {
    await getDb().outbox.clear();
  });

  it("retries a server fault with growing waits and gets the change through, unattended", async () => {
    const phone = device(student);
    const queued = await queueWrite(student.id, "item", "insert", {
      kind: "todo",
      title: "Lab report",
    });
    phone.setNetwork("fault");

    await phone.runner.setOwner(student.id);
    await phone.fireRetry();
    phone.setNetwork("up");
    await phone.fireRetry();

    expect(phone.retries.map((retry) => retry.delayMs)).toEqual([retryDelay(0), retryDelay(1)]);
    expect(retryDelay(1)).toBeGreaterThan(retryDelay(0));
    expect((await itemRow(queued.rowId))?.title).toBe("Lab report");
    expect(phone.waiting()).toEqual([]);
  });

  it("shows offline when the app cannot be reached, however online the browser says it is", async () => {
    // Campus Wi-Fi before its login page: the browser reports online, and before 0.5-4
    // the widget showed a green dot while every change failed silently.
    const phone = device(student, true);
    await queueWrite(student.id, "item", "insert", { kind: "todo", title: "Behind the portal" });
    phone.setNetwork("portal");

    await phone.runner.setOwner(student.id);

    expect(phone.status()?.reachable).toBe(false);
    expect(phone.waiting()).toHaveLength(1);
    expect((await getPendingWrites(student.id))[0]?.attempts).toBe(0);

    // Logged in to the Wi-Fi: no browser event fires, and the waiting retry finds the app.
    phone.setNetwork("up");
    await phone.fireRetry();
    expect(phone.status()?.reachable).toBe(true);
    expect(await getPendingWrites(student.id)).toEqual([]);
  });

  it("shows offline with nothing to send, when the pull finds no app", async () => {
    const phone = device(student, true);
    phone.setNetwork("down");

    await phone.runner.setOwner(student.id);

    expect(phone.status()?.reachable).toBe(false);
  });

  it("believes the browser's offline event at once, but its online event only makes it try", async () => {
    const phone = device(student, true);
    await phone.runner.setOwner(student.id);

    phone.runner.hint(false);
    expect(phone.status()?.reachable).toBe(false);

    phone.setNetwork("portal");
    await phone.runner.hint(true);
    expect(phone.status()?.reachable).toBe(false);
  });

  it("holds changes and asks for sign-in when the session has expired, without retrying on a timer", async () => {
    const expired = harnessFetch(null);
    const statuses: SyncStatus[] = [];
    const retries: number[] = [];
    const runner = createSyncRunner({
      drain: (ownerId) => drainOutbox(ownerId, expired),
      refresh: async () => true,
      schedule: (_run, delayMs) => {
        retries.push(delayMs);
        return () => {};
      },
      onStatus: (status) => statuses.push(status),
      initiallyReachable: true,
    });
    await queueWrite(student.id, "item", "insert", { kind: "todo", title: "After sign-in" });

    await runner.setOwner(student.id);

    expect(statuses.at(-1)).toMatchObject({ needsSignIn: true, reachable: true });
    expect(retries).toEqual([]);
    expect(await getPendingWrites(student.id)).toHaveLength(1);
  });

  it("an answer from elsewhere (the pull on refocus) brings it back online and sends what waited", async () => {
    const phone = device(student, true);
    const queued = await queueWrite(student.id, "item", "insert", {
      kind: "todo",
      title: "Waited",
    });
    phone.setNetwork("down");
    await phone.runner.setOwner(student.id);
    expect(phone.status()?.reachable).toBe(false);

    phone.setNetwork("up");
    await phone.runner.observe(true);

    expect(phone.status()?.reachable).toBe(true);
    expect((await itemRow(queued.rowId))?.title).toBe("Waited");
  });
});
