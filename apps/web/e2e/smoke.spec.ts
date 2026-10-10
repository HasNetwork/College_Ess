import { expect, test } from "@playwright/test";

test("smoke test - homepage loads", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("h1")).toContainText("College Ess");
});
