import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { register } from "../src/instrumentation";
import { REQUIRED_SERVER_ENV } from "../src/lib/env";

// RULES R18: a server missing required configuration refuses to start. Exercised through
// the real Next.js startup hook (`register`), not the helper it calls.
describe("startup configuration gate", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("exits the process, naming the variable, when a required one is missing", async () => {
    vi.stubEnv("NEXT_RUNTIME", "nodejs");
    vi.stubEnv("TICK_SECRET", undefined);
    const exit = vi.spyOn(process, "exit").mockImplementation((() => undefined) as never);
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});

    await register();

    expect(exit).toHaveBeenCalledWith(1);
    expect(logged.mock.calls.flat().join(" ")).toContain("TICK_SECRET");
  });

  it("lets a fully configured server start", async () => {
    vi.stubEnv("NEXT_RUNTIME", "nodejs");
    const exit = vi.spyOn(process, "exit").mockImplementation((() => undefined) as never);

    await register();

    expect(exit).not.toHaveBeenCalled();
  });

  it(".env.example documents every variable the server refuses to start without (R8)", () => {
    const example = readFileSync(new URL("../../../.env.example", import.meta.url), "utf8");
    const documented = new Set([...example.matchAll(/^([A-Z0-9_]+)=/gm)].map((m) => m[1]));
    expect(REQUIRED_SERVER_ENV.filter((name) => !documented.has(name))).toEqual([]);
  });
});
