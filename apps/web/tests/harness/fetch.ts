import { requireEnv } from "@clg-ess/db";
import { type AuthenticatedAs, request } from "./client";

/**
 * A `fetch` for client code under test: the sync pull, push subscribe, photo upload. A
 * request to the app's own origin runs the real route handler through `request`, signed in
 * as `as`. Any other URL (storage, a push service) goes to `external`, and without one it
 * is refused, so client code under test never reaches the network.
 */
export function harnessFetch(
  as: AuthenticatedAs | null,
  external?: (outgoing: Request) => Response | Promise<Response>,
): typeof fetch {
  const origin = new URL(requireEnv("BETTER_AUTH_URL")).origin;
  return async (input, init) => {
    // Client code calls relative paths ("/api/sync"), as it does in a browser.
    const target = input instanceof Request ? input.url : String(input);
    const outgoing = new Request(new URL(target, origin), init);
    const url = new URL(outgoing.url);
    if (url.origin !== origin) {
      if (!external) throw new Error(`harnessFetch: no stub for ${outgoing.method} ${url.href}`);
      return external(outgoing);
    }
    const text = await outgoing.text();
    const res = await request(outgoing.method, `${url.pathname}${url.search}`, {
      as,
      body: text === "" ? undefined : JSON.parse(text),
    });
    return new Response(res.body === undefined ? null : JSON.stringify(res.body), {
      status: res.status,
      headers: { "content-type": "application/json" },
    });
  };
}
