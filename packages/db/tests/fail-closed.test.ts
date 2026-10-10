import { afterEach, describe, expect, it, vi } from "vitest";
import { createDbClient } from "../src/client";
import { assertEnv, requireEnv } from "../src/env";

// RULES R18: required configuration is a loud crash, never a silent downgrade.
describe("fail-closed configuration", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("requireEnv names the variable when it is missing, empty or blank", () => {
    vi.stubEnv("CLG_TEST_A", undefined);
    expect(() => requireEnv("CLG_TEST_A")).toThrow("CLG_TEST_A");
    vi.stubEnv("CLG_TEST_A", "");
    expect(() => requireEnv("CLG_TEST_A")).toThrow("CLG_TEST_A");
    vi.stubEnv("CLG_TEST_A", "   ");
    expect(() => requireEnv("CLG_TEST_A")).toThrow("CLG_TEST_A");
  });

  it("requireEnv returns the configured value unchanged", () => {
    vi.stubEnv("CLG_TEST_A", "configured");
    expect(requireEnv("CLG_TEST_A")).toBe("configured");
  });

  it("assertEnv names every missing variable in one error, not just the first", () => {
    vi.stubEnv("CLG_TEST_A", undefined);
    vi.stubEnv("CLG_TEST_B", "present");
    vi.stubEnv("CLG_TEST_C", undefined);
    expect(() => assertEnv(["CLG_TEST_A", "CLG_TEST_B", "CLG_TEST_C"])).toThrow(
      /CLG_TEST_A, CLG_TEST_C/,
    );
    expect(() => assertEnv(["CLG_TEST_B"])).not.toThrow();
  });

  it("a missing DATABASE_URL throws instead of booting a throwaway in-memory database", () => {
    vi.stubEnv("DATABASE_URL", undefined);
    expect(() => createDbClient()).toThrow("DATABASE_URL");
    expect(globalThis.__clg_ess_pglite__).toBeUndefined();
  });
});
