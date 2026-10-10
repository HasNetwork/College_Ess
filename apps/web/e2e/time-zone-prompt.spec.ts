import { type Browser, type Page, expect, test } from "@playwright/test";

// A student's reminders run on the time zone saved to their account, taken from their
// phone at sign-up (0.5-4 §0, decision 2). Opened on a device set to another zone, the app
// asks before switching: Keep is remembered on that device, Switch saves the device's zone.

async function signUpIn(browser: Browser, timezoneId: string) {
  const { parallelIndex, repeatEachIndex } = test.info();
  const context = await browser.newContext({
    timezoneId,
    // Sign-up is rate-limited per client IP (PLAN §9.4); each simulated student gets its own.
    extraHTTPHeaders: {
      "x-forwarded-for": `10.40.3.${parallelIndex * 10 + repeatEachIndex}`,
    },
  });
  const page = await context.newPage();
  await page.goto("/sign-up");
  await page.fill("#name", "Travelling Student");
  await page.fill("#email", `tz-${Date.now()}-${parallelIndex}-${repeatEachIndex}@clg.edu`);
  await page.fill("#password", "SecurePassword123!");
  await page.click("button[type='submit']");
  await page.waitForURL("/dashboard", { timeout: 45000 });
  return { context, page };
}

/** The same account, opened on a device whose clock is set to `timezoneId`. */
async function sameAccountOn(browser: Browser, home: Page, timezoneId: string) {
  const context = await browser.newContext({
    timezoneId,
    storageState: await home.context().storageState(),
  });
  const page = await context.newPage();
  await page.goto("/dashboard");
  await expect(page.locator("h1")).toHaveText("Dashboard", { timeout: 15000 });
  return page;
}

const savedZone = (page: Page) =>
  page.evaluate(async () => {
    const { user } = await (await fetch("/api/auth/get-session")).json();
    return user.timezone as string;
  });

test("asks before switching to the device's time zone, and remembers a Keep", async ({
  browser,
}) => {
  const home = await signUpIn(browser, "Asia/Kolkata");
  // The phone's own zone was saved at sign-up, so there is nothing to ask there.
  await expect(home.page.getByRole("button", { name: /^Switch to / })).toHaveCount(0);

  // A trip: the laptop is on New York time. Keep, and it doesn't ask again on this device.
  const trip = await sameAccountOn(browser, home.page, "America/New_York");
  const keep = trip.getByRole("button", { name: /^Keep / });
  await expect(keep).toBeVisible({ timeout: 15000 });
  await keep.click();
  await expect(trip.getByRole("button", { name: /^Switch to / })).toHaveCount(0);
  await trip.reload();
  await expect(trip.locator("h1")).toHaveText("Dashboard", { timeout: 15000 });
  await expect(trip.getByRole("button", { name: /^Switch to / })).toHaveCount(0);
  expect(await savedZone(trip)).not.toBe("America/New_York");

  // Another New York device asks afresh; Switch saves the device's zone to the account.
  const moved = await sameAccountOn(browser, home.page, "America/New_York");
  const switchZone = moved.getByRole("button", { name: /^Switch to / });
  await expect(switchZone).toBeVisible({ timeout: 15000 });
  await switchZone.click();
  await expect(switchZone).toHaveCount(0);
  await expect.poll(() => savedZone(moved), { timeout: 15000 }).toBe("America/New_York");
  await moved.reload();
  await expect(moved.locator("h1")).toHaveText("Dashboard", { timeout: 15000 });
  await expect(moved.getByRole("button", { name: /^Switch to / })).toHaveCount(0);
});
