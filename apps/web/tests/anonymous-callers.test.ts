import { uuidv7 } from "@clg-ess/db";
import { describe, expect, it } from "vitest";
import { ROUTE_PATTERNS, loadRoute, request } from "./harness";

// Every route handler, every method it exports, called with no session (RULES R17). Routes
// are discovered from the filesystem, so a new route is swept the moment its file exists:
// it must refuse an anonymous caller, or be added below with the reason it is public.

const PUBLIC_BY_DESIGN: Record<string, string> = {
  "GET /api/auth/[...all]": "Better Auth itself: signing in cannot require being signed in",
  "POST /api/auth/[...all]": "Better Auth itself: signing in cannot require being signed in",
  "GET /api/compass":
    "the guide works signed out, as platform defaults at student level (compass-route.test.ts)",
  "GET /api/reminders/subscribe":
    "the VAPID public key, which a browser needs before it can subscribe",
};

const HTTP_METHODS = ["GET", "HEAD", "OPTIONS", "POST", "PUT", "PATCH", "DELETE"];

const endpoints: string[] = [];
for (const pattern of ROUTE_PATTERNS) {
  const handlers = await loadRoute(pattern);
  for (const method of HTTP_METHODS) {
    if (typeof handlers[method] === "function") endpoints.push(`${method} ${pattern}`);
  }
}

// A concrete URL for a pattern: dynamic segments get an id that exists nowhere.
const concrete = (pattern: string) =>
  pattern.replace(/\[\.\.\.[^\]]+\]/g, "anything").replace(/\[[^\]]+\]/g, () => uuidv7());

describe("anonymous callers", () => {
  it("finds the routes, and every public entry names one that still exists", () => {
    expect(endpoints).toContain("POST /api/sync");
    for (const endpoint of Object.keys(PUBLIC_BY_DESIGN)) {
      expect(endpoints).toContain(endpoint);
    }
  });

  it.each(endpoints.filter((endpoint) => !(endpoint in PUBLIC_BY_DESIGN)))(
    "%s refuses a caller with no session (401)",
    async (endpoint) => {
      const [method = "", pattern = ""] = endpoint.split(" ");
      // No body on purpose: a route must refuse before it reads anything from the caller.
      const res = await request(method, concrete(pattern));
      expect(res.status).toBe(401);
    },
  );
});
