import { afterEach, describe, expect, it, vi } from "vitest";

// RULES R18. The package entry used to end in `if (DATABASE_URL) { seed(); process.exit() }`.
// Ten app files import it, so the first production cold start would have seeded the live
// database and killed the server mid-request. Kept in its own file: it asserts on process
// globals that any other test creating a client would pollute.
describe("importing @clg-ess/db", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it("creates no database client and never exits, even with DATABASE_URL set", async () => {
    // The old guard fired exactly when this is set, which is every real deployment.
    vi.stubEnv("DATABASE_URL", "pglite://memory");
    const exit = vi.spyOn(process, "exit").mockImplementation((() => undefined) as never);

    // A cold import of the whole package: about 1 s idle, but 5.8 s on a machine busy with
    // a parallel `next build`. Hence the 30 s timeout the other db tests use too.
    await import("../src/index");
    // Let any import-time async work (the old `seed().then(exit)`) get a chance to run.
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(globalThis.__clg_ess_pglite__).toBeUndefined();
    expect(exit).not.toHaveBeenCalled();
  }, 30000);
});
