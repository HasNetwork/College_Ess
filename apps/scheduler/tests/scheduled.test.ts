import { describe, expect, it, vi } from "vitest";
import worker, { type Env } from "../src/index.js";

// The Worker is what makes reminders fire: every minute it asks the app to run a tick.
// These tests call its `scheduled` export the way the Workers runtime does, with the one
// outbound edge (fetch) stubbed, so nothing here reaches a network.

const APP_URL = "https://app.test";
const TICK_SECRET = "tick-secret-for-tests";

const controller = {
  scheduledTime: Date.parse("2026-09-25T10:00:00Z"),
  cron: "* * * * *",
  noRetry: () => {},
} as unknown as ScheduledController;
const ctx = {
  waitUntil: () => {},
  passThroughOnException: () => {},
} as unknown as ExecutionContext;

const tick = (env: Env) => worker.scheduled(controller, env, ctx);

describe("scheduled tick", () => {
  it("refuses to tick without APP_URL or TICK_SECRET, and calls nothing (R18)", async () => {
    // An empty secret would reach the app as a tick nobody can authenticate, and a missing
    // URL has no safe default: both must fail the cron run where Cloudflare shows it.
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    await expect(tick({ TICK_SECRET })).rejects.toThrow("APP_URL");
    await expect(tick({ APP_URL })).rejects.toThrow("TICK_SECRET");
    await expect(tick({ APP_URL, TICK_SECRET: "" })).rejects.toThrow("TICK_SECRET");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("asks the app for a tick, with the shared secret the tick route checks", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(Response.json({ success: true }));
    vi.spyOn(console, "log").mockImplementation(() => {});

    await tick({ APP_URL, TICK_SECRET });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0] ?? [];
    expect(url).toBe(`${APP_URL}/api/internal/tick`);
    expect(init?.method).toBe("POST");
    // The route accepts either header; without one of them every tick is a 401 and no
    // reminder is ever sent.
    const headers = new Headers(init?.headers);
    expect(
      headers.get("x-tick-secret") === TICK_SECRET ||
        headers.get("authorization") === `Bearer ${TICK_SECRET}`,
    ).toBe(true);
  });

  it("logs a tick the app refused, so a broken deploy shows in the Worker's logs", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("Unauthorized", { status: 401 }));
    vi.spyOn(console, "log").mockImplementation(() => {});
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});

    await tick({ APP_URL, TICK_SECRET });

    expect(errors).toHaveBeenCalledWith(expect.stringContaining("401"));
  });
});
