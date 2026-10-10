// Runs once when a Next.js server instance starts (skipped during `next build`).
// Missing required configuration stops the process: a loud crash, never a silent
// downgrade (RULES R18). The gate lives in lib/env so no Node-only API reaches an
// edge bundle.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { enforceServerEnv } = await import("./lib/env");
    enforceServerEnv();
    const { seedInMemoryDatabase } = await import("./lib/in-memory-seed");
    await seedInMemoryDatabase();
  }
}
