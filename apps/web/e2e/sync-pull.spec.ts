import { type Page, expect, test } from "@playwright/test";

// The sync pull in a real browser (0.5-3 §2): the provider pulls for the signed-in account,
// the persister writes the result to IndexedDB, and signing out leaves no one's rows.

type SyncCache = { watermark: string; tables: Record<string, Record<string, { title?: string }>> };

/** The pulled rows as persisted to IndexedDB, or null when the device holds none. */
function persistedSync(page: Page): Promise<SyncCache | null> {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const open = indexedDB.open("clg_ess_sync");
      open.onsuccess = () => resolve(open.result);
      open.onerror = () => reject(open.error);
    });
    const record = await new Promise<{ value?: unknown } | undefined>((resolve, reject) => {
      const get = db
        .transaction("keyValue", "readonly")
        .objectStore("keyValue")
        .get("REACT_QUERY_OFFLINE_CACHE");
      get.onsuccess = () => resolve(get.result);
      get.onerror = () => reject(get.error);
    });
    db.close();
    const queries =
      (
        record?.value as {
          clientState?: { queries?: Array<{ queryKey: unknown; state: { data: unknown } }> };
        }
      )?.clientState?.queries ?? [];
    const sync = queries.find((query) => JSON.stringify(query.queryKey) === '["sync"]');
    return (sync?.state.data as SyncCache | undefined) ?? null;
  });
}

/** Writes through the server as this browser's account, the way another device's outbox would. */
function writeItem(page: Page, op: "insert" | "delete", rowId: string, title?: string) {
  return page.evaluate(
    async ({ op, rowId, title }) => {
      // Every queued change says whose it is (0.5-4); the server refuses anyone else's.
      const session = (await (await fetch("/api/auth/get-session")).json()) as {
        user: { id: string };
      };
      const entry = {
        id: crypto.randomUUID(),
        createdAt: Date.now(),
        ownerId: session.user.id,
        table: "item",
        op,
        rowId,
        payload: op === "insert" ? { kind: "todo", title } : {},
        attempts: 0,
        status: "pending",
      };
      const res = await fetch("/api/sync", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ entries: [entry] }),
      });
      return ((await res.json()) as { applied: string[] }).applied.length;
    },
    { op, rowId, title },
  );
}

test("pulls server changes into the device cache, and keeps nothing after sign-out", async ({
  page,
}) => {
  const { parallelIndex, repeatEachIndex } = test.info();
  // Sign-up is rate-limited per client IP (PLAN §9.4); each simulated student gets its own.
  await page.context().setExtraHTTPHeaders({
    "x-forwarded-for": `198.51.100.${100 + parallelIndex * 10 + repeatEachIndex}`,
  });
  await page.goto("/sign-up");
  await page.fill("#name", "Sync Student");
  await page.fill("#email", `sync-${Date.now()}-${parallelIndex}-${repeatEachIndex}@clg.edu`);
  await page.fill("#password", "SecurePassword123!");
  await page.click("button[type='submit']");
  await page.waitForURL("/dashboard", { timeout: 45000 });

  const rowId = crypto.randomUUID();
  expect(await writeItem(page, "insert", rowId, "Pulled into the cache")).toBe(1);
  await page.reload();
  await expect
    .poll(async () => (await persistedSync(page))?.tables.item?.[rowId]?.title, { timeout: 15000 })
    .toBe("Pulled into the cache");
  const before = (await persistedSync(page))?.watermark;

  expect(await writeItem(page, "delete", rowId)).toBe(1);
  await page.reload();
  await expect
    .poll(
      async () => {
        const cache = await persistedSync(page);
        return cache && cache.watermark !== before ? (cache.tables.item?.[rowId] ?? "gone") : null;
      },
      { timeout: 15000 },
    )
    .toBe("gone");

  // The service worker keeps no copy of any /api/ answer: its default would store each
  // under its URL alone, where the next account on this device could be served it. The
  // guide's read (/api/compass) depends on who is asking, so read it first (0.5-4 §6).
  await page.goto("/guide");
  await expect(page.locator("h1")).toContainText("Compass");
  const cachedApis = await page.evaluate(async () => {
    const paths: string[] = [];
    for (const name of await caches.keys()) {
      for (const request of await (await caches.open(name)).keys()) {
        const { pathname } = new URL(request.url);
        if (pathname.startsWith("/api/")) paths.push(pathname);
      }
    }
    return paths;
  });
  expect(cachedApis).toEqual([]);
  await page.goto("/dashboard");

  await page.click("button:has-text('Sign Out')");
  // Signed out, the student lands on the welcome page (0.5-5).
  await page.waitForURL("/", { timeout: 30000 });
  await expect.poll(() => persistedSync(page), { timeout: 15000 }).toBeNull();
});
