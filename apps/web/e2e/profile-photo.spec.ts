import { expect, test } from "@playwright/test";

// A refused upload in a real browser (0.5-3 §3). The photo is compressed by the browser's
// own canvas, the bucket answers the PUT with 403 as B2 does at a free limit (PLAN §4.1),
// and the student keeps the photo and is told why.

// page.route cannot see a request the service worker handles itself.
test.use({ serviceWorkers: "block" });

test("keeps the photo and says why when storage refuses the upload", async ({ page }) => {
  const { parallelIndex, repeatEachIndex } = test.info();
  // Sign-up is rate-limited per client IP (PLAN §9.4); each simulated student gets its own.
  await page.context().setExtraHTTPHeaders({
    "x-forwarded-for": `198.51.100.${150 + parallelIndex * 10 + repeatEachIndex}`,
  });
  await page.goto("/sign-up");
  await page.fill("#name", "Photo Student");
  await page.fill("#email", `photo-${Date.now()}-${parallelIndex}-${repeatEachIndex}@clg.edu`);
  await page.fill("#password", "SecurePassword123!");
  await page.click("button[type='submit']");
  await page.waitForURL("/dashboard", { timeout: 45000 });

  // A real camera-sized JPEG, drawn in the browser so no binary fixture is committed.
  const jpeg = await page.evaluate(async () => {
    const canvas = new OffscreenCanvas(3000, 2000);
    const context = canvas.getContext("2d");
    if (!context) throw new Error("no 2d context");
    const gradient = context.createLinearGradient(0, 0, 3000, 2000);
    gradient.addColorStop(0, "#3366cc");
    gradient.addColorStop(1, "#cc6633");
    context.fillStyle = gradient;
    context.fillRect(0, 0, 3000, 2000);
    const blob = await canvas.convertToBlob({ type: "image/jpeg", quality: 0.95 });
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let binary = "";
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary);
  });

  const puts: Array<{ type: string | null; size: number }> = [];
  await page.route(/backblazeb2\.com/, async (route) => {
    const request = route.request();
    const cors = {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "PUT, GET",
      "access-control-allow-headers": "content-type",
    };
    if (request.method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers: cors });
      return;
    }
    puts.push({
      type: request.headers()["content-type"] ?? null,
      size: request.postDataBuffer()?.byteLength ?? 0,
    });
    await route.fulfill({
      status: 403,
      headers: cors,
      body: "<Error><Code>AccessDenied</Code><Message>Cap exceeded</Message></Error>",
    });
  });

  await page.getByTestId("profile-photo-input").setInputFiles({
    name: "camera.jpg",
    mimeType: "image/jpeg",
    buffer: Buffer.from(jpeg, "base64"),
  });

  await expect(page.getByTestId("profile-photo-error")).toContainText(/couldn.t be uploaded/i, {
    timeout: 20000,
  });
  await expect(page.getByTestId("profile-photo-preview")).toBeVisible();
  // What reached the bucket was the browser's WebP, a fraction of the camera JPEG.
  expect(puts).toHaveLength(1);
  expect(puts[0]?.type).toBe("image/webp");
  expect(puts[0]?.size).toBeGreaterThan(0);
  expect(puts[0]?.size).toBeLessThan(Buffer.from(jpeg, "base64").byteLength);
  expect(puts[0]?.size).toBeLessThan(300 * 1024);
});
