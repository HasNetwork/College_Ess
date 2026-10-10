import { randomBytes } from "node:crypto";
import { defineConfig, devices } from "@playwright/test";
import webpush from "web-push";

// The server has no configuration fallbacks (RULES R18), so the E2E run supplies explicit
// test values. Nothing here is a real secret: the database is in-memory PGlite.
const vapid = webpush.generateVAPIDKeys();
const serverEnv = {
  DATABASE_URL: "pglite://memory",
  BETTER_AUTH_SECRET: randomBytes(32).toString("base64"),
  BETTER_AUTH_URL: "http://localhost:3000",
  S3_ENDPOINT: "https://s3.us-west-004.backblazeb2.com",
  S3_REGION: "us-west-004",
  S3_ACCESS_KEY_ID: "e2e-access-key",
  S3_SECRET_ACCESS_KEY: randomBytes(32).toString("base64"),
  S3_BUCKET: "e2e-bucket",
  TICK_SECRET: randomBytes(32).toString("base64url"),
  VAPID_PUBLIC_KEY: vapid.publicKey,
  VAPID_PRIVATE_KEY: vapid.privateKey,
  VAPID_SUBJECT: "mailto:e2e@example.com",
};

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // A retry that passes still fails CI: a flaky test is reported, never hidden by a retry.
  failOnFlakyTests: !!process.env.CI,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  webServer: {
    // A production server, not `next dev`: dev compiles each route on first request, and
    // parallel workers racing those compiles is what made auth-flow time out. CI builds in
    // an earlier step; locally the build runs here unless a server is already listening.
    command: process.env.CI ? "pnpm start" : "pnpm build && pnpm start",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 360 * 1000,
    env: serverEnv,
    stdout: "pipe",
    stderr: "pipe",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
