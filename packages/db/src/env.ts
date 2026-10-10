/**
 * Required configuration, read fail-closed (RULES R18).
 *
 * There is deliberately no default parameter: a missing secret must crash loudly,
 * never downgrade silently. Write `requireEnv("X")`, never `process.env.X || "default"`.
 */
export function requireEnv(name: string): string {
  const value = process.env[name];
  if (value === undefined || value.trim() === "") {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

/**
 * Asserts every listed variable is present, naming all of the missing ones at once
 * so a misconfigured deploy is fixed in one pass rather than one crash per variable.
 */
export function assertEnv(names: readonly string[]): void {
  const missing = names.filter((name) => {
    const value = process.env[name];
    return value === undefined || value.trim() === "";
  });
  if (missing.length > 0) {
    throw new Error(
      `Refusing to start: missing required environment variables: ${missing.join(", ")}`,
    );
  }
}
