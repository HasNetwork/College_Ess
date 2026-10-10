import { type Browser, type Locator, devices, expect, test } from "@playwright/test";

// 0.5-5, the frontend contract, in a real browser against a production build.

async function signUp(browser: Browser, lane: number, timezoneId = "Asia/Kolkata") {
  const { parallelIndex, repeatEachIndex } = test.info();
  const context = await browser.newContext({
    timezoneId,
    // Sign-up is rate-limited per client IP (PLAN §9.4); each simulated student gets its own.
    extraHTTPHeaders: {
      "x-forwarded-for": `10.50.${lane}.${parallelIndex * 10 + repeatEachIndex}`,
    },
  });
  const page = await context.newPage();
  await page.goto("/sign-up");
  await page.fill("#name", "Contract Student");
  await page.fill("#email", `fc-${lane}-${Date.now()}-${parallelIndex}-${repeatEachIndex}@clg.edu`);
  await page.fill("#password", "SecurePassword123!");
  await page.click("button[type='submit']");
  await page.waitForURL("/dashboard", { timeout: 45000 });
  return { context, page };
}

// 0.5-4 suspected, and 0.5-5 confirmed in Better Auth's parser: a login page answering the
// session check with a 200 became the session itself. The student read as signed out and
// the app's root read `.user.id` off a string.
test.describe("behind a Wi-Fi login page", () => {
  // Playwright's routing cannot see requests a service worker makes, and the worker passes
  // every /api/ request to the network itself (sw.ts): block it, or the portal isn't there.
  test.use({ serviceWorkers: "block" });

  test("a Wi-Fi login page answering for College Ess doesn't sign the student out", async ({
    browser,
  }) => {
    const { page } = await signUp(browser, 1);
    await page.route("**/api/auth/get-session*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "text/html",
        body: "<html><body><h1>Sign in to Campus Wi-Fi</h1></body></html>",
      }),
    );

    await page.goto("/dashboard");
    await expect(page.getByRole("main").getByText("Can't reach College Ess")).toBeVisible({
      timeout: 15000,
    });
    await expect(page).toHaveURL(/\/dashboard$/);

    // Back on a real network, the student is still signed in.
    await page.unroute("**/api/auth/get-session*");
    await page.reload();
    await expect(page.locator("h1")).toHaveText("Dashboard", { timeout: 15000 });
  });
});

// Four tabs opened "page not found", and the Compass tab pointed at a redirect, so it was
// never shown as the current one (0.5-5 §7).
test("every tab opens a real page, and Compass stays current inside the guide", async ({
  page,
  request,
}) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto("/guide/faq");
  const tabBar = page.getByRole("navigation", { name: "Mobile primary navigation" });

  await expect(tabBar.getByRole("link", { name: "Compass" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  const hrefs = await tabBar
    .getByRole("link")
    .evaluateAll((links) => links.map((link) => link.getAttribute("href") ?? ""));
  expect(hrefs.length).toBeGreaterThan(0);
  for (const href of hrefs) {
    expect((await request.get(href)).status(), href).toBeLessThan(400);
  }
});

// The FAQ was four paragraphs baked into the bundle, one of them wrong: it promised a
// field-by-field merge the sync layer never did (0.5-5 §6). Now each question is a guide page.
test("the FAQ shows the guide's questions and answers them truthfully", async ({ page }) => {
  await page.goto("/guide/faq");
  const first = page.getByRole("button", { name: "Does College Ess work offline?" });
  await expect(first).toHaveAttribute("aria-expanded", "true", { timeout: 15000 });

  const twoDevices = page.getByRole("button", {
    name: "What happens if I change the same thing on two devices?",
  });
  await twoDevices.focus();
  await page.keyboard.press("Enter");
  await expect(twoDevices).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByText(/The change that reaches College Ess last wins/)).toBeVisible();
  await expect(page.getByText(/revision protocol|field-level merge/)).toHaveCount(0);

  // A search result links straight to its answer, and opens it.
  await page.goto("/guide/search?q=quiet%20hours");
  await page.getByRole("link", { name: /Why did a reminder arrive at 7 AM/ }).click();
  await expect(page).toHaveURL(/\/guide\/faq#faq-quiet-hours$/);
  await expect(
    page.getByRole("button", { name: "Why did a reminder arrive at 7 AM instead of at night?" }),
  ).toHaveAttribute("aria-expanded", "true", { timeout: 15000 });
});

// On a phone a toast sat over the end of the page, and the time-zone prompt covered Settings'
// last row until it was answered (0.5-4's finding).
test("on a phone, a toast never hides the end of a page", async ({ browser }) => {
  const home = await signUp(browser, 2, "Asia/Kolkata");
  // The same account on a phone set to New York time: the time-zone prompt is a toast.
  const phone = await browser.newContext({
    timezoneId: "America/New_York",
    viewport: { width: 375, height: 640 },
    storageState: await home.context.storageState(),
  });
  const page = await phone.newPage();
  await page.goto("/settings");
  await expect(page.getByRole("button", { name: /^Keep / })).toBeVisible({ timeout: 15000 });

  const scrolls = await page.evaluate(
    () => document.documentElement.scrollHeight > window.innerHeight,
  );
  expect(scrolls, "the page must be long enough to reach the toast").toBe(true);
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));

  const contentBottom = await page
    .getByRole("main")
    .evaluate((main) => main.lastElementChild?.getBoundingClientRect().bottom ?? 0);
  const toasts = await page.locator("[data-slot=toast-region]").boundingBox();
  expect(toasts).not.toBeNull();
  expect(contentBottom).toBeLessThanOrEqual(toasts?.y ?? 0);
});

// The theme chosen in the app wins over the device's own setting (0.5-5 §2). Tokens always
// followed the choice; Tailwind's `dark:` followed the device, so the two halves disagreed.
// The chosen option's pill is drawn with `dark:`, which is what this looks at.
test.describe("on a dark phone, choosing Light", () => {
  test.use({ colorScheme: "dark" });

  test("makes the page light, dark: utilities included", async ({ page }) => {
    await page.goto("/guide");
    const themes = page.getByRole("banner").getByRole("radiogroup", { name: "Theme selection" });
    const light = themes.getByRole("radio", { name: "Light mode" });
    await light.click();

    await expect(page.locator("html")).not.toHaveClass(/\bdark\b/);
    await expect(page.locator("body")).toHaveCSS("background-color", "rgb(248, 249, 250)");
    // Light's pill is the card colour; the dark-mode pill (`dark:`) would be the raised one.
    await expect(light).toHaveCSS("background-color", "rgb(255, 255, 255)");
  });
});

test.describe("on a light phone, choosing Dark", () => {
  test.use({ colorScheme: "light" });

  test("makes the page dark", async ({ page }) => {
    await page.goto("/guide");
    const themes = page.getByRole("banner").getByRole("radiogroup", { name: "Theme selection" });
    const dark = themes.getByRole("radio", { name: "Dark mode" });
    await dark.click();

    await expect(page.locator("html")).toHaveClass(/\bdark\b/);
    await expect(page.locator("body")).toHaveCSS("background-color", "rgb(9, 9, 11)");
    await expect(dark).toHaveCSS("background-color", "rgb(24, 24, 27)");
  });
});

/** The area a tap lands on: the element, grown by an absolutely placed ::after if it has one. */
function tapArea(control: Locator) {
  return control.evaluate((element) => {
    const box = element.getBoundingClientRect();
    const after = getComputedStyle(element, "::after");
    let { top, right, bottom, left } = box;
    if (after.content !== "none" && after.position === "absolute") {
      const inset = (value: string) => Number.parseFloat(value);
      if (!Number.isNaN(inset(after.top))) top = Math.min(top, box.top + inset(after.top));
      if (!Number.isNaN(inset(after.bottom))) {
        bottom = Math.max(bottom, box.bottom - inset(after.bottom));
      }
      if (!Number.isNaN(inset(after.left))) left = Math.min(left, box.left + inset(after.left));
      if (!Number.isNaN(inset(after.right)))
        right = Math.max(right, box.right - inset(after.right));
    }
    return { width: Math.round(right - left), height: Math.round(bottom - top) };
  });
}

async function expectTappable(control: Locator, name: string) {
  await expect(control, name).toBeVisible({ timeout: 15000 });
  const area = await tapArea(control);
  expect(area.width, `${name} width`).toBeGreaterThanOrEqual(44);
  expect(area.height, `${name} height`).toBeGreaterThanOrEqual(44);
}

// R6: every control is at least 44 px to tap. The theme options (~28 px), the install banner's
// dismiss (~24 px) and the reminder switch (24 px tall) were not (0.5-5 §5).
test("the controls 0.5-5 named are at least 44 px to tap, on a phone", async ({ browser }) => {
  const { page } = await signUp(browser, 3);
  await page.setViewportSize({ width: 375, height: 800 });
  await page.addInitScript(() => {
    Object.defineProperty(Notification, "permission", { get: () => "default" });
  });
  await page.goto("/settings");

  const header = page.getByRole("banner");
  for (const name of ["Light mode", "Dark mode", "System theme"]) {
    await expectTappable(header.getByRole("radio", { name }), name);
  }
  await expectTappable(page.getByRole("switch", { name: "Reminders on this device" }), "reminders");
  await expectTappable(page.getByRole("switch", { name: "Quiet hours" }), "quiet hours");
  const tabs = page
    .getByRole("navigation", { name: "Mobile primary navigation" })
    .getByRole("link");
  for (const tab of await tabs.all()) await expectTappable(tab, "a tab");
});

test("the install banner's dismiss is at least 44 px to tap, on an iPhone", async ({ browser }) => {
  // Safari on an iPhone, not installed: the banner shows.
  const context = await browser.newContext({ ...devices["iPhone 13"] });
  const page = await context.newPage();
  await page.goto("/guide");
  await expectTappable(page.getByRole("button", { name: "Dismiss install banner" }), "dismiss");
  await context.close();
});
