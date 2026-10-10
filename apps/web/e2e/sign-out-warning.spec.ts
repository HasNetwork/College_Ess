import { type Page, expect, test } from "@playwright/test";

// Signing out with changes not yet sent warns first (0.5-4 §0, decision 3): cancelling
// keeps them, and signing out anyway deletes them from the device, so nobody who uses it
// next can see or send them. No screen queues a change until Phase 1-1, so the test puts
// one in the outbox itself, exactly as the outbox stores it.

// Playwright's routing cannot see requests a service worker makes.
test.use({ serviceWorkers: "block" });

/** The account's unsent changes, read straight from IndexedDB. */
function unsent(page: Page, ownerId: string): Promise<number> {
  return page.evaluate(async (owner) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const open = indexedDB.open("clg_ess_sync");
      open.onsuccess = () => resolve(open.result);
      open.onerror = () => reject(open.error);
    });
    const count = await new Promise<number>((resolve, reject) => {
      const request = db
        .transaction("outbox", "readonly")
        .objectStore("outbox")
        .index("ownerId")
        .count(owner);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    db.close();
    return count;
  }, ownerId);
}

test("warns before signing out with unsent changes, and deletes them only if you go ahead", async ({
  page,
}) => {
  const { parallelIndex, repeatEachIndex } = test.info();
  // Sign-up is rate-limited per client IP (PLAN §9.4); each simulated student gets its own.
  await page.context().setExtraHTTPHeaders({
    "x-forwarded-for": `10.40.4.${parallelIndex * 10 + repeatEachIndex}`,
  });
  await page.goto("/sign-up");
  await page.fill("#name", "Leaving Student");
  await page.fill("#email", `leaving-${Date.now()}-${parallelIndex}-${repeatEachIndex}@clg.edu`);
  await page.fill("#password", "SecurePassword123!");
  await page.click("button[type='submit']");
  await page.waitForURL("/dashboard", { timeout: 45000 });
  const ownerId = await page.evaluate(
    async () => (await (await fetch("/api/auth/get-session")).json()).user.id as string,
  );

  // The change can't reach the app, so it stays queued.
  await page.route("**/api/sync", (route) =>
    route.request().method() === "POST" ? route.abort() : route.continue(),
  );
  await page.evaluate(async (owner) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const open = indexedDB.open("clg_ess_sync");
      open.onsuccess = () => resolve(open.result);
      open.onerror = () => reject(open.error);
    });
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("outbox", "readwrite");
      tx.objectStore("outbox").put({
        id: crypto.randomUUID(),
        createdAt: Date.now(),
        ownerId: owner,
        table: "item",
        op: "insert",
        rowId: crypto.randomUUID(),
        payload: { kind: "todo", title: "Written offline" },
        attempts: 0,
        status: "pending",
      });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  }, ownerId);
  expect(await unsent(page, ownerId)).toBe(1);

  // Warned, with the count; cancelling keeps the change and the session.
  await page.getByRole("button", { name: "Sign Out" }).click();
  const warning = page.getByRole("alertdialog");
  await expect(warning).toContainText("1 change");
  await warning.getByRole("button", { name: "Cancel" }).click();
  await expect(warning).toBeHidden();
  await expect(page).toHaveURL(/\/dashboard/);
  expect(await unsent(page, ownerId)).toBe(1);

  // Escape closes it too, as every overlay must (0.5-5 §9), and keeps the change.
  await page.getByRole("button", { name: "Sign Out" }).click();
  await expect(warning).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(warning).toBeHidden();
  expect(await unsent(page, ownerId)).toBe(1);

  // Going ahead deletes it from the device, then signs out.
  await page.getByRole("button", { name: "Sign Out" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Sign out and delete" }).click();
  await page.waitForURL("/", { timeout: 30000 });
  expect(await unsent(page, ownerId)).toBe(0);
});
