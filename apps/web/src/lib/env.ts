import { assertEnv } from "@clg-ess/db";

/**
 * Every variable the server cannot run without. Asserted once at startup from
 * `instrumentation.ts`, so a misconfigured deploy refuses to boot (RULES R18).
 * Documented in docs/ENV.md; a test fails if `.env.example` omits any of them.
 */
export const REQUIRED_SERVER_ENV = [
  "DATABASE_URL",
  "BETTER_AUTH_SECRET",
  "BETTER_AUTH_URL",
  "S3_ENDPOINT",
  "S3_REGION",
  "S3_ACCESS_KEY_ID",
  "S3_SECRET_ACCESS_KEY",
  "S3_BUCKET",
  "TICK_SECRET",
  "VAPID_PUBLIC_KEY",
  "VAPID_PRIVATE_KEY",
  "VAPID_SUBJECT",
] as const;

/**
 * Startup gate, called from `instrumentation.ts`. Next.js only logs an error thrown from
 * `register()` and keeps the process alive serving 500s on every route (observed in
 * 0.5-1), so exit instead: a misconfigured deploy must fail visibly, not limp.
 */
export function enforceServerEnv(): void {
  try {
    assertEnv(REQUIRED_SERVER_ENV);
  } catch (err) {
    console.error(`[startup] ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}
