import { readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { requireEnv } from "@clg-ess/db";
import { testApiHandler } from "next-test-api-route-handler";

/**
 * Boundary-test harness (PLAN 0.5-1 §3, RULES R17).
 *
 * Issues real HTTP requests to the real route handler modules. NTARH runs each module
 * inside Next's own AppRouteRouteModule, so `headers()`, NextRequest and error handling
 * behave as in production. Nothing about the route is reimplemented or mocked: the
 * session is a real Better Auth cookie and the database is PGlite with the shipping
 * migrations. Middleware and instrumentation are not exercised (NTARH does not run them).
 */

type RouteModule = Record<string, unknown>;
type Params = Record<string, string | string[]>;

interface Route {
  /** The route as Next names it, e.g. "/api/assets/[id]/complete". */
  pattern: string;
  segments: string[];
  file: string;
}

const APP_DIR = fileURLToPath(new URL("../../src/app", import.meta.url));

// Next resolves static segments before dynamic ones, and dynamic before catch-all.
const segmentRank = (segment: string) =>
  segment.startsWith("[...") ? 2 : segment.startsWith("[") ? 1 : 0;

function bySpecificity(a: Route, b: Route): number {
  const length = Math.max(a.segments.length, b.segments.length);
  for (let i = 0; i < length; i++) {
    const diff = segmentRank(a.segments[i] ?? "") - segmentRank(b.segments[i] ?? "");
    if (diff !== 0) return diff;
  }
  return b.segments.length - a.segments.length;
}

// Discovered from the filesystem, never a hand-kept list: a new route is reachable by the
// harness (and by any sweep over ROUTE_PATTERNS) the moment its file exists.
const ROUTES: Route[] = readdirSync(APP_DIR, { recursive: true, encoding: "utf8" })
  .filter((entry) => /(^|[\\/])route\.ts$/.test(entry))
  .map((entry) => {
    // Route groups like "(auth)" organise files without appearing in the URL.
    const segments = entry
      .split(/[\\/]/)
      .slice(0, -1)
      .filter((segment) => !/^\(.+\)$/.test(segment));
    return { pattern: `/${segments.join("/")}`, segments, file: join(APP_DIR, entry) };
  })
  .sort(bySpecificity);

export const ROUTE_PATTERNS: readonly string[] = ROUTES.map((route) => route.pattern);

/** The module Next loads for `pattern` (one of ROUTE_PATTERNS): its exports are the handlers. */
export async function loadRoute(pattern: string): Promise<RouteModule> {
  const route = ROUTES.find((candidate) => candidate.pattern === pattern);
  if (!route) throw new Error(`harness: no route ${pattern}`);
  return import(route.file.replaceAll("\\", "/"));
}

function match(route: Route, parts: string[]): Params | null {
  const params: Params = {};
  for (const [i, segment] of route.segments.entries()) {
    const catchAll = /^\[\.\.\.(.+)\]$/.exec(segment)?.[1];
    if (catchAll) {
      if (parts.length <= i) return null;
      params[catchAll] = parts.slice(i);
      return params;
    }
    const part = parts[i];
    if (part === undefined) return null;
    const dynamic = /^\[(.+)\]$/.exec(segment)?.[1];
    if (dynamic) params[dynamic] = part;
    else if (segment !== part) return null;
  }
  return parts.length === route.segments.length ? params : null;
}

export interface AuthenticatedAs {
  /** A `Cookie` header value carrying a real Better Auth session. */
  cookie: string;
}

export interface RequestOptions {
  /** The session to send. Omit, or pass null, to call as an anonymous visitor. */
  as?: AuthenticatedAs | null;
  body?: unknown;
  headers?: Record<string, string>;
}

// biome-ignore lint/suspicious/noExplicitAny: bodies are untyped JSON, asserted field by field
export interface HarnessResponse<T = any> {
  status: number;
  headers: Headers;
  body: T;
}

function parseBody(text: string): unknown {
  if (text === "") return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

// biome-ignore lint/suspicious/noExplicitAny: see HarnessResponse
export async function request<T = any>(
  method: string,
  path: string,
  options: RequestOptions = {},
): Promise<HarnessResponse<T>> {
  const url = new URL(path, requireEnv("BETTER_AUTH_URL"));
  const parts = url.pathname.split("/").filter(Boolean).map(decodeURIComponent);

  let route: Route | undefined;
  let params: Params | null = null;
  for (const candidate of ROUTES) {
    params = match(candidate, parts);
    if (params) {
      route = candidate;
      break;
    }
  }
  if (!route || !params) {
    // Loud on purpose: a typo'd path must not become a vacuously passing denial test.
    throw new Error(`harness: no route handler matches ${url.pathname}`);
  }

  const appHandler: RouteModule = await import(route.file.replaceAll("\\", "/"));

  let response: HarnessResponse<T> | undefined;
  await testApiHandler({
    appHandler,
    params,
    url: url.toString(),
    async test({ fetch }) {
      const headers = new Headers(options.headers);
      if (options.as) headers.set("cookie", options.as.cookie);
      let body: string | undefined;
      if (options.body !== undefined) {
        headers.set("content-type", "application/json");
        body = JSON.stringify(options.body);
      }
      const res = await fetch({ method, headers, body });
      response = {
        status: res.status,
        headers: res.headers,
        body: parseBody(await res.text()) as T,
      };
    },
  });

  if (!response) throw new Error(`harness: ${method} ${path} produced no response`);
  return response;
}

export const api = {
  // biome-ignore lint/suspicious/noExplicitAny: see HarnessResponse
  get: <T = any>(path: string, options?: RequestOptions) => request<T>("GET", path, options),
  // biome-ignore lint/suspicious/noExplicitAny: see HarnessResponse
  post: <T = any>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>("POST", path, { ...options, body }),
  // biome-ignore lint/suspicious/noExplicitAny: see HarnessResponse
  delete: <T = any>(path: string, options?: RequestOptions) => request<T>("DELETE", path, options),
};
