// NTARH must load before any Next.js module ("undefined behaviour" otherwise, per its
// README). A setup file runs before each test file's imports, so this holds regardless of
// how Biome sorts the imports inside individual test files.
import "next-test-api-route-handler";

import { randomBytes } from "node:crypto";
import { S3Client } from "@aws-sdk/client-s3";
import { beforeEach, vi } from "vitest";
import webpush from "web-push";

// Explicit test configuration. Production code has no fallbacks (RULES R18), so tests
// supply real-shaped values instead of leaning on defaults. Assigned unconditionally:
// a developer shell exporting a real DATABASE_URL must never reach a test.
const vapid = webpush.generateVAPIDKeys();
Object.assign(process.env, {
  DATABASE_URL: "pglite://memory",
  BETTER_AUTH_SECRET: randomBytes(32).toString("base64"),
  BETTER_AUTH_URL: "http://localhost:3000",
  S3_ENDPOINT: "https://s3.us-west-004.backblazeb2.com",
  S3_REGION: "us-west-004",
  S3_ACCESS_KEY_ID: "test-access-key",
  S3_SECRET_ACCESS_KEY: randomBytes(32).toString("base64"),
  S3_BUCKET: "test-bucket",
  TICK_SECRET: randomBytes(32).toString("base64url"),
  VAPID_PUBLIC_KEY: vapid.publicKey,
  VAPID_PRIVATE_KEY: vapid.privateKey,
  VAPID_SUBJECT: "mailto:tests@example.com",
});

// The outbound network edges are blocked by default, so "runs without a network" is
// enforced rather than hoped for. A test that needs storage or a push service stubs the edge
// explicitly with its own mockImplementation — and can then assert what was sent.
beforeEach(() => {
  vi.spyOn(S3Client.prototype, "send").mockRejectedValue(
    new Error("Blocked: unexpected storage network call in a test. Stub S3Client.prototype.send."),
  );
  vi.spyOn(webpush, "sendNotification").mockRejectedValue(
    new Error("Blocked: unexpected push network call in a test. Stub webpush.sendNotification."),
  );
});
