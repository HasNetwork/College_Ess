import { expect, test } from "@playwright/test";
import * as OTPAuth from "otpauth";

test.describe("Authentication and TOTP 2FA E2E Flow", () => {
  test("signup -> enroll TOTP -> login with TOTP -> login with backup code", async ({ page }) => {
    const { parallelIndex, repeatEachIndex } = test.info();
    // Better Auth rate-limits sign-in to 3 per 10 s per client IP, and in production mode
    // it is on. Parallel workers all reach the server from one loopback address, so they
    // shared one budget and tripped each other's 429s — the "flake" under fullyParallel.
    // Real students arrive from their own addresses; give each simulated one its own.
    await page.context().setExtraHTTPHeaders({
      "x-forwarded-for": `198.51.100.${1 + parallelIndex * 10 + repeatEachIndex}`,
    });
    // Unique across parallel workers: Date.now() alone collides when two start in one ms.
    const uniqueEmail = `student-${Date.now()}-${parallelIndex}-${repeatEachIndex}@clg.edu`;
    const password = "SecurePassword123!";
    const fullName = "Alex Mercer";

    // 1. Sign Up
    await page.goto("/sign-up");
    await page.fill("#name", fullName);
    await page.fill("#email", uniqueEmail);
    await page.fill("#password", password);
    await page.click("button[type='submit']");

    // Expect navigation to /dashboard
    await page.waitForURL("/dashboard", { timeout: 45000 });
    await expect(page.locator("h1")).toContainText("Dashboard");
    await expect(page.locator("body")).toContainText(fullName);
    await expect(page.locator("body")).toContainText("Disabled");

    // 2. Enroll in TOTP 2FA
    await page.fill("#confirm-password", password);
    await page.click("button:has-text('Enroll in 2FA')");

    // Wait for TOTP URI and backup codes to appear
    const totpInput = page.locator("#totp-uri-input");
    await expect(totpInput).toBeVisible({ timeout: 10000 });
    const totpUri = await totpInput.inputValue();
    expect(totpUri).toContain("otpauth://totp/");

    // Capture backup codes
    const backupCodeElements = page.locator(".backup-code");
    await expect(backupCodeElements.first()).toBeVisible();
    const backupCodes = await backupCodeElements.allInnerTexts();
    expect(backupCodes.length).toBeGreaterThan(0);

    // Generate TOTP code using OTPAuth
    const totp = OTPAuth.URI.parse(totpUri);
    const initialCode = totp.generate();

    // Verify and activate 2FA
    await page.fill("#verify-code", initialCode);
    await page.click("button:has-text('Verify and Activate 2FA')");
    await expect(page.locator("body")).toContainText(
      "Two-factor authentication is active on your account.",
      { timeout: 10000 },
    );

    // 3. Sign Out: to the welcome page, and its Sign In (0.5-5)
    await page.click("button:has-text('Sign Out')");
    await page.waitForURL("/", { timeout: 30000 });
    await page.getByRole("link", { name: "Sign In" }).click();
    await page.waitForURL("/sign-in", { timeout: 30000 });

    // 4. Sign In with TOTP
    await page.fill("#email", uniqueEmail);
    await page.fill("#password", password);
    await page.click("button[type='submit']");

    // Should redirect to /two-factor
    await page.waitForURL("/two-factor", { timeout: 30000 });
    await expect(page.locator("h1")).toContainText("Two-Factor Authentication");

    // Generate new code and submit
    const loginCode = totp.generate();
    await page.fill("#code", loginCode);
    await page.click("button[type='submit']");

    // Should reach /dashboard
    await page.waitForURL("/dashboard", { timeout: 30000 });
    await expect(page.locator("h1")).toContainText("Dashboard");

    // 5. Sign Out again
    await page.click("button:has-text('Sign Out')");
    await page.waitForURL("/", { timeout: 30000 });
    await page.getByRole("link", { name: "Sign In" }).click();
    await page.waitForURL("/sign-in", { timeout: 30000 });

    // 6. Sign In using Backup Code
    await page.fill("#email", uniqueEmail);
    await page.fill("#password", password);
    await page.click("button[type='submit']");

    // Should redirect to /two-factor
    await page.waitForURL("/two-factor", { timeout: 30000 });
    await page.click("button:has-text('Lost access? Use a backup recovery code')");

    // Enter first backup code
    const recoveryCode = backupCodes[0];
    if (!recoveryCode) {
      throw new Error("No backup codes available for test");
    }
    await page.fill("#code", recoveryCode.trim());
    await page.click("button[type='submit']");

    // Should reach /dashboard
    await page.waitForURL("/dashboard", { timeout: 30000 });
    await expect(page.locator("h1")).toContainText("Dashboard");
  });
});
