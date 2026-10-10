import { inferAdditionalFields, twoFactorClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import type { auth } from "./auth";
import { AppUnreachableError } from "./sync/reach";

/**
 * Better Auth's `fetch`, refusing a success that isn't College Ess. Every auth answer is
 * JSON. A Wi-Fi login page, or any other page, answering with a 200 would otherwise become
 * the session itself: Better Auth keeps non-JSON text as the data (`client/parser.mjs`), the
 * student reads as signed out, and `session.data.user` is undefined where code expects it.
 * Unreachable instead, as the sync layer already treats it (0.5-4 §5, 0.5-5).
 */
export async function authFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const response = await fetch(input, init);
  const type = response.headers.get("content-type") ?? "";
  if (response.ok && response.status !== 204 && !type.includes("application/json")) {
    throw new AppUnreachableError(`Not an answer from College Ess (${type || "no content type"})`);
  }
  return response;
}

// No baseURL: the auth API is served from this same origin (/api/auth), which is the
// client's default. The old localhost fallback pointed any build missing the var at localhost.
export const authClient = createAuthClient({
  fetchOptions: { customFetchImpl: authFetch },
  plugins: [
    // Types the server-owned `role` and `collegeId` on the client's session. A type-only
    // import: nothing from the server module reaches the browser.
    inferAdditionalFields<typeof auth>(),
    twoFactorClient({
      twoFactorPage: "/two-factor",
    }),
  ],
});

/**
 * Opens the app once sign-up, sign-in or two-factor has succeeded. A full page load, never
 * `router.push`: Better Auth refreshes the session store 10 ms after the call resolves
 * (`client/proxy.mjs`), and the sync provider keeps that store live on every page. A
 * client-side navigation can render the dashboard's sign-in check inside those 10 ms,
 * read "signed out", and send the student straight back to sign-in.
 */
export function enterApp(): void {
  window.location.assign("/dashboard");
}
