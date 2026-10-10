import { type Page, expect, test } from "@playwright/test";

// The Settings tab holds settings (0.5-3 §4), and a browser that can't deliver reminders is
// told so instead of being offered a switch that can never fire (PLAN §8.1). The
// notification permission is pinned per page: headless Chromium's own default is not
// something to depend on.

async function openSettingsWithPermission(page: Page, permission: NotificationPermission) {
  await page.addInitScript((value) => {
    Object.defineProperty(Notification, "permission", { get: () => value });
  }, permission);
  await page.goto("/settings");
  await expect(page.locator("h1")).toHaveText("Settings");
}

test("offers the reminder switch where it can work, and a notice where it can't", async ({
  page,
}) => {
  const { parallelIndex, repeatEachIndex } = test.info();
  // Sign-up is rate-limited per client IP (PLAN §9.4); each simulated student gets its own.
  await page.context().setExtraHTTPHeaders({
    "x-forwarded-for": `198.51.100.${200 + parallelIndex * 10 + repeatEachIndex}`,
  });
  await page.goto("/sign-up");
  await page.fill("#name", "Settings Student");
  await page.fill("#email", `settings-${Date.now()}-${parallelIndex}-${repeatEachIndex}@clg.edu`);
  await page.fill("#password", "SecurePassword123!");
  await page.click("button[type='submit']");
  await page.waitForURL("/dashboard", { timeout: 45000 });

  // Not asked yet: the switch, off, with the page's other controls. It is not tapped here:
  // subscribing needs a real push service (a device check, R10.1).
  await openSettingsWithPermission(page, "default");
  await expect(page.getByRole("switch", { name: "Reminders on this device" })).toHaveAttribute(
    "aria-checked",
    "false",
    { timeout: 15000 },
  );
  // The page's own theme control; the header carries another.
  await expect(
    page
      .getByRole("region", { name: "Appearance" })
      .getByRole("radiogroup", { name: "Theme selection" }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: /What each setting does/ })).toHaveAttribute(
    "href",
    "/guide/settings",
  );

  // Blocked in the browser: say so, and offer no switch for this device's reminders.
  const blocked = await page.context().newPage();
  await openSettingsWithPermission(blocked, "denied");
  await expect(blocked.getByText(/Notifications are blocked/)).toBeVisible({ timeout: 15000 });
  await expect(blocked.getByRole("switch", { name: "Reminders on this device" })).toHaveCount(0);
});

test.describe("the account's reminder settings (0.5-4)", () => {
  test.use({ timezoneId: "Asia/Kolkata" });

  test("saves quiet hours and the time zone to the account", async ({ page }) => {
    const { parallelIndex, repeatEachIndex } = test.info();
    await page.context().setExtraHTTPHeaders({
      "x-forwarded-for": `10.40.2.${parallelIndex * 10 + repeatEachIndex}`,
    });
    await page.goto("/sign-up");
    await page.fill("#name", "Night Owl");
    await page.fill("#email", `owl-${Date.now()}-${parallelIndex}-${repeatEachIndex}@clg.edu`);
    await page.fill("#password", "SecurePassword123!");
    await page.click("button[type='submit']");
    await page.waitForURL("/dashboard", { timeout: 45000 });
    await openSettingsWithPermission(page, "default");

    // On by default; switched off, it stays off: it is saved to the account, not the page.
    const quiet = page.getByRole("switch", { name: "Quiet hours" });
    await expect(quiet).toHaveAttribute("aria-checked", "true", { timeout: 15000 });
    await quiet.click();
    await expect(quiet).toHaveAttribute("aria-checked", "false");
    await page.getByLabel("Time zone").selectOption("America/New_York");
    await expect(page.getByLabel("Time zone")).toHaveValue("America/New_York");

    // Both saves have reached the account before the reload, which would cancel one in flight.
    const saved = () =>
      page.evaluate(async () => {
        const { user } = await (await fetch("/api/auth/get-session")).json();
        return { quiet: user.quietHoursEnabled as boolean, zone: user.timezone as string };
      });
    await expect
      .poll(saved, { timeout: 15000 })
      .toEqual({ quiet: false, zone: "America/New_York" });

    await page.reload();
    await expect(page.getByRole("switch", { name: "Quiet hours" })).toHaveAttribute(
      "aria-checked",
      "false",
      { timeout: 15000 },
    );
    await expect(page.getByLabel("Time zone")).toHaveValue("America/New_York");
  });
});
