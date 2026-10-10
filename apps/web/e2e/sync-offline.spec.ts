import { expect, test } from "@playwright/test";

test.describe("offline, as the app sees it (0.5-4 §5)", () => {
  // Playwright's routing cannot see requests a service worker makes; the worker only
  // passes /api/ through to the network anyway (sw.ts).
  test.use({ serviceWorkers: "block" });

  test("shows offline when College Ess can't be reached, though the browser says online", async ({
    page,
  }) => {
    const { parallelIndex, repeatEachIndex } = test.info();
    // Sign-up is rate-limited per client IP (PLAN §9.4); each simulated student gets its own.
    await page.context().setExtraHTTPHeaders({
      "x-forwarded-for": `10.40.1.${parallelIndex * 10 + repeatEachIndex}`,
    });
    await page.goto("/sign-up");
    await page.fill("#name", "Portal Student");
    await page.fill("#email", `portal-${Date.now()}-${parallelIndex}-${repeatEachIndex}@clg.edu`);
    await page.fill("#password", "SecurePassword123!");
    await page.click("button[type='submit']");
    await page.waitForURL("/dashboard", { timeout: 45000 });
    const offlineBadge = page.getByTestId("sync-offline-badge");

    // Campus Wi-Fi before its sign-in page: every request gets the portal's HTML. Before
    // 0.5-4 the widget showed "Online" here, because the browser said so.
    await page.route("**/api/sync**", (route) =>
      route.fulfill({ status: 200, contentType: "text/html", body: "<html>CampusNet</html>" }),
    );
    await page.reload();
    await expect(offlineBadge).toBeVisible({ timeout: 20000 });
    expect(await page.evaluate(() => navigator.onLine)).toBe(true);

    // Signed in to the Wi-Fi: no browser event fires, and a retry finds the app.
    await page.unroute("**/api/sync**");
    await expect(offlineBadge).toBeHidden({ timeout: 30000 });
  });
});

test.describe("Sync & Offline E2E Flow", () => {
  test("shows the offline badge when the network drops and clears it on reconnect", async ({
    page,
    context,
  }) => {
    // The sync status widget lives in AppShell, and "/" does not render AppShell. This test
    // used to visit "/" and so had never passed. /guide renders AppShell with no session.
    await page.goto("/guide");
    await expect(page.locator("h1")).toContainText("Compass");

    const offlineBadge = page.getByTestId("sync-offline-badge");
    // Online and idle, the widget renders nothing, so the badge appearing below is caused
    // by the network drop rather than always being there.
    await expect(offlineBadge).toBeHidden();

    await context.setOffline(true);
    await expect(offlineBadge).toBeVisible({ timeout: 10000 });

    await context.setOffline(false);
    await expect(offlineBadge).toBeHidden({ timeout: 10000 });
  });
});
