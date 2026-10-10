import { afterEach, describe, expect, it, vi } from "vitest";
import { authFetch } from "../src/lib/auth-client";
import { AppUnreachableError } from "../src/lib/sync/reach";

// On campus Wi-Fi a login page can answer any request with a 200. Handed to Better Auth, that
// page became the session: the student read as signed out and the app's root read
// `session.data.user.id` off a string (0.5-4's finding, confirmed in 0.5-5). The browser's
// half of this, the dashboard staying put behind such a page, is e2e/frontend-contract.spec.ts.

afterEach(() => {
  vi.unstubAllGlobals();
});

function answer(body: string, status: number, contentType?: string) {
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response(body, {
          status,
          headers: contentType ? { "content-type": contentType } : {},
        }),
    ),
  );
}

describe("authFetch: only College Ess's own answers reach Better Auth", () => {
  it("refuses a login page answering with a 200", async () => {
    answer("<html><body>Sign in to Campus Wi-Fi</body></html>", 200, "text/html");
    await expect(authFetch("/api/auth/get-session")).rejects.toBeInstanceOf(AppUnreachableError);
  });

  it("refuses a 200 with no content type", async () => {
    answer("Welcome", 200);
    await expect(authFetch("/api/auth/get-session")).rejects.toBeInstanceOf(AppUnreachableError);
  });

  it("passes the app's JSON through, a session or none", async () => {
    answer('{"user":{"id":"u1"}}', 200, "application/json; charset=utf-8");
    await expect((await authFetch("/api/auth/get-session")).json()).resolves.toEqual({
      user: { id: "u1" },
    });
    answer("null", 200, "application/json");
    await expect((await authFetch("/api/auth/get-session")).json()).resolves.toBeNull();
  });

  // Errors are Better Auth's to read: a 401 means signed out for certain.
  it("passes an error status through whatever its body", async () => {
    answer("<html>Bad gateway</html>", 502, "text/html");
    expect((await authFetch("/api/auth/get-session")).status).toBe(502);
    answer('{"message":"Unauthorized"}', 401, "application/json");
    expect((await authFetch("/api/auth/get-session")).status).toBe(401);
  });
});
