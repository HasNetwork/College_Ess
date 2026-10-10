import "fake-indexeddb/auto";
import { QueryClient } from "@tanstack/react-query";
import {
  type PersistedClient,
  persistQueryClientRestore,
  persistQueryClientSave,
} from "@tanstack/react-query-persist-client";
import { beforeEach, describe, expect, it } from "vitest";
import { getDb } from "../src/lib/sync/db";
import { PERSIST_OPTIONS, createDexiePersister } from "../src/lib/sync/persister";
import { SYNC_QUERY_KEY, type SyncCache } from "../src/lib/sync/pull";

// What the device keeps on disk (0.5-4 §6), with the options the provider really passes.

const CACHE_KEY = "REACT_QUERY_OFFLINE_CACHE";

const syncCache: SyncCache = {
  owner: { userId: "018e3d64-2661-7000-8000-0000000000aa", collegeId: null },
  watermark: "2026-09-26T00:00:00.000Z",
  tables: { item: { a: { id: "a", title: "Revise optics" } } },
};

async function stored(): Promise<PersistedClient | undefined> {
  return (await getDb().keyValue.get(CACHE_KEY))?.value as PersistedClient | undefined;
}

/** Waits out the persister's write throttle. */
const flushed = () => new Promise((resolve) => setTimeout(resolve, 30));

describe("the persisted cache", () => {
  beforeEach(async () => {
    await getDb().keyValue.clear();
  });

  it("writes the sync pull to disk and no other query, so no grant ever lands there", async () => {
    // A shared device keeps IndexedDB between students. The pull records whose rows it
    // holds and is dropped at sign-out; any other query would simply stay.
    const client = new QueryClient();
    client.setQueryData(SYNC_QUERY_KEY, syncCache);
    client.setQueryData(["grants"], [{ permission: "manage:college" }]);
    client.setQueryData(["profile"], { email: "student@clg.edu" });

    await persistQueryClientSave({
      queryClient: client,
      persister: createDexiePersister({ throttleTime: 0 }),
      ...PERSIST_OPTIONS,
    });
    await flushed();

    const keys = (await stored())?.clientState.queries.map((query) => query.queryKey);
    expect(keys).toEqual([SYNC_QUERY_KEY]);
  });

  it("restores a device's rows after three days offline", async () => {
    // TanStack's default drops a persisted cache a day old: a phone offline over a long
    // weekend opened to an empty app.
    const persister = createDexiePersister({ throttleTime: 0 });
    const client = new QueryClient();
    client.setQueryData(SYNC_QUERY_KEY, syncCache);
    await persistQueryClientSave({ queryClient: client, persister, ...PERSIST_OPTIONS });
    await flushed();
    const saved = await stored();
    if (!saved) throw new Error("nothing was persisted");
    const threeDaysAgo = Date.now() - 3 * 24 * 60 * 60 * 1000;
    await getDb().keyValue.put({ key: CACHE_KEY, value: { ...saved, timestamp: threeDaysAgo } });

    const reopened = new QueryClient();
    await persistQueryClientRestore({ queryClient: reopened, persister, ...PERSIST_OPTIONS });

    expect(reopened.getQueryData<SyncCache>(SYNC_QUERY_KEY)?.tables.item?.a?.title).toBe(
      "Revise optics",
    );
  });
});
